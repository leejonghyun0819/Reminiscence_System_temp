import json
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from database import get_db_cursor


router = APIRouter(prefix="/api/generated-notes", tags=["Generated Notes"])


class GeneratedNotePayload(BaseModel):
    note: Dict[str, Any]


class BatchDeletePayload(BaseModel):
    ids: List[str] = Field(default_factory=list)


def _validate_note(note: Dict[str, Any]) -> str:
    note_id = str(note.get("id") or "").strip()
    if not note_id:
        raise HTTPException(status_code=400, detail="노트 id가 필요합니다.")
    return note_id


@router.get("")
def get_generated_notes():
    with get_db_cursor() as cursor:
        cursor.execute(
            "SELECT note_json FROM generated_notes ORDER BY created_at DESC"
        )
        rows = cursor.fetchall()

    notes: List[Dict[str, Any]] = []
    for row in rows:
        try:
            notes.append(json.loads(row["note_json"]))
        except (TypeError, json.JSONDecodeError):
            continue
    return notes


@router.post("")
def save_generated_note(payload: GeneratedNotePayload):
    note = payload.note
    note_id = _validate_note(note)
    serialized = json.dumps(note, ensure_ascii=False)

    with get_db_cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO generated_notes (id, note_json)
            VALUES (?, ?)
            ON CONFLICT(id) DO UPDATE SET
                note_json = excluded.note_json,
                updated_at = CURRENT_TIMESTAMP
            """,
            (note_id, serialized),
        )
    return note


@router.put("/{note_id}")
def update_generated_note(note_id: str, payload: GeneratedNotePayload):
    note = {**payload.note, "id": note_id}
    serialized = json.dumps(note, ensure_ascii=False)

    with get_db_cursor() as cursor:
        cursor.execute(
            "UPDATE generated_notes SET note_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (serialized, note_id),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="저장된 추억 노트를 찾을 수 없습니다.")
    return note


@router.delete("/{note_id}")
def delete_generated_note(note_id: str):
    with get_db_cursor() as cursor:
        cursor.execute("DELETE FROM generated_notes WHERE id = ?", (note_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="저장된 추억 노트를 찾을 수 없습니다.")
    return {"success": True, "id": note_id}


@router.post("/batch-delete")
def batch_delete_generated_notes(payload: BatchDeletePayload):
    unique_ids = list(dict.fromkeys(note_id for note_id in payload.ids if note_id))
    if not unique_ids:
        return {"success": True, "deleted": 0}

    placeholders = ",".join("?" for _ in unique_ids)
    with get_db_cursor() as cursor:
        cursor.execute(
            f"DELETE FROM generated_notes WHERE id IN ({placeholders})",
            tuple(unique_ids),
        )
        deleted = cursor.rowcount
    return {"success": True, "deleted": deleted}
