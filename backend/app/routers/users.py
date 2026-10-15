from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_admin
from ..models import Role, User
from ..schemas import UserOut, UserUpdate
from ..security import hash_password

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return user


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    data = payload.model_dump(exclude_unset=True)

    if user.id == current_admin.id and data.get("role") == Role.client:
        raise HTTPException(status_code=400, detail="Нельзя понизить собственную роль")

    if user.id == current_admin.id and data.get("is_active") is False:
        raise HTTPException(status_code=400, detail="Нельзя заблокировать собственную учётную запись")

    if data.get("is_active") is False and user.role == Role.admin.value:
        other_active_admins = (
            db.query(User)
            .filter(
                User.role == Role.admin.value,
                User.is_active.is_(True),
                User.id != user.id,
            )
            .count()
        )
        if other_active_admins == 0:
            raise HTTPException(
                status_code=400,
                detail="Нельзя заблокировать последнего активного администратора",
            )

    if "full_name" in data:
        user.full_name = data["full_name"]
    if "is_active" in data:
        user.is_active = data["is_active"]
    if "role" in data and data["role"] is not None:
        user.role = data["role"].value
    if data.get("password"):
        user.hashed_password = hash_password(data["password"])

    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    if user_id == current_admin.id:
        raise HTTPException(status_code=400, detail="Нельзя удалить собственную учётную запись")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    db.delete(user)
    db.commit()
