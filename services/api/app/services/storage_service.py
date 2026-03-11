from urllib.parse import urljoin

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

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

    def ensure_bucket(self) -> None:
        try:
            self.client.head_bucket(Bucket=settings.s3_bucket)
            return
        except ClientError:
            pass

        # MinIO/local default region works without explicit location constraint.
        if settings.s3_region and settings.s3_region != "us-east-1":
            self.client.create_bucket(
                Bucket=settings.s3_bucket,
                CreateBucketConfiguration={"LocationConstraint": settings.s3_region},
            )
            return
        self.client.create_bucket(Bucket=settings.s3_bucket)

    def presign_get(self, object_key: str, expires_in: int = 900) -> str:
        return self.presign_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.s3_bucket, "Key": object_key},
            ExpiresIn=expires_in,
        )

    def public_url(self, object_key: str) -> str:
        base = (settings.s3_public_endpoint or settings.s3_endpoint).rstrip("/") + "/"
        return urljoin(base, f"{settings.s3_bucket}/{object_key}")

    def delete_object(self, object_key: str) -> None:
        self.client.delete_object(Bucket=settings.s3_bucket, Key=object_key)
