from pydantic import BaseModel


class UploadSignRequest(BaseModel):
    session_id: str
    file_name: str
    content_type: str = "application/octet-stream"


class UploadSignResponse(BaseModel):
    object_key: str
    upload_url: str


class UploadCompleteRequest(BaseModel):
    session_id: str
    object_key: str
    file_name: str


class DownloadSignRequest(BaseModel):
    object_key: str


class DownloadSignResponse(BaseModel):
    download_url: str
