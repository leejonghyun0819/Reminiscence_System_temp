# backend/models.py
from typing import Optional, List
from pydantic import BaseModel

class ImagePayload(BaseModel):
    base64: str
    mimeType: str

class GeminiAnalyzeRequest(BaseModel):
    images: List[ImagePayload]
    audioBase64: Optional[str] = None
    audioMimeType: Optional[str] = None

class CurrentDraft(BaseModel):
    title: Optional[str] = ""
    location: Optional[str] = ""
    yearEstimate: Optional[str] = ""
    description: Optional[str] = ""
    storyCaption: Optional[str] = ""
    audioTranscriptSummary: Optional[str] = ""

class GeminiRefineRequest(BaseModel):
    currentDraft: CurrentDraft
    refineNote: str

class UpdateMemoryRequest(BaseModel):
    title: Optional[str] = None
    location: Optional[str] = None
    yearEstimate: Optional[str] = None
    description: Optional[str] = None
    storyCaption: Optional[str] = None
    categoryFolder: Optional[str] = None
    mode: Optional[str] = None  # 🌟 추가 ("childhood" 또는 "travel")
    curatedNote: Optional[dict] = None
    interviewData: Optional[dict] = None

class CreateFolderRequest(BaseModel):
    name: str

class MoveFolderRequest(BaseModel):
    categoryFolder: str

class BatchMoveFoldersRequest(BaseModel):
    albumIds: List[str]
    categoryFolder: str

class SwapImageRequest(BaseModel):
    oldUrl: str
    newUrl: str

class AppendImageRequest(BaseModel):
    imageUrl: str

class DeleteImageRequest(BaseModel):
    targetImageUrl: str

class BatchAlbumIdsRequest(BaseModel):
    albumIds: List[str]