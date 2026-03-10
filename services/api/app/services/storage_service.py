from urllib.parse import urljoin

import boto3
from botocore.client import Config

from ..core.config import settings


class StorageService:
    def __init__(self) -> None:
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region,
            config=Config(signature_version="s3v4"),
        )
        presign_endpoint = settings.s3_public_endpoint or settings.s3_endpoint
        self.presign_client = boto3.client(
            "s3",
            endpoint_url=presign_endpoint,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region,
            config=Config(signature_version="s3v4"),
        )

    def presign_put(self, object_key: str, content_type: str, expires_in: int = 900) -> str:
        return self.presign_client.generate_presigned_url(
            "put_object",
            Params={"Bucket": settings.s3_bucket, "Key": object_key, "ContentType": content_type},
            ExpiresIn=expires_in,
        )

    def presign_get(self, object_key: str, expires_in: int = 900) -> str:
        return self.presign_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.s3_bucket, "Key": object_key},
            ExpiresIn=expires_in,
        )

    def public_url(self, object_key: str) -> str:
        base = (settings.s3_public_endpoint or settings.s3_endpoint).rstrip("/") + "/"
        return urljoin(base, f"{settings.s3_bucket}/{object_key}")
