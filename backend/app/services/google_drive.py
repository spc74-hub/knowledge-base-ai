"""
Google Drive integration service.
Handles OAuth flow and file operations.
"""
import os
import json
from typing import Optional, List, Dict, Any
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from app.core.config import settings

# Scopes required for Google Drive access
SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.metadata.readonly'
]

# MIME types we can extract text from
SUPPORTED_MIME_TYPES = {
    'application/vnd.google-apps.document': 'Google Docs',
    'application/vnd.google-apps.spreadsheet': 'Google Sheets',
    'application/vnd.google-apps.presentation': 'Google Slides',
    'application/pdf': 'PDF',
    'text/plain': 'Text',
    'text/html': 'HTML',
    'text/markdown': 'Markdown',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
    'message/rfc822': 'Email',
    # Audio files (transcribed via Whisper)
    'audio/x-m4a': 'Audio',
    'audio/mp4': 'Audio',
    'audio/m4a': 'Audio',
    'audio/mpeg': 'Audio',
    'audio/mp3': 'Audio',
    'audio/wav': 'Audio',
    'audio/x-wav': 'Audio',
    'audio/webm': 'Audio',
    'audio/ogg': 'Audio',
}

# Audio MIME types for special handling
AUDIO_MIME_TYPES = {
    'audio/x-m4a', 'audio/mp4', 'audio/m4a', 'audio/mpeg',
    'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg'
}

# Export MIME types for Google Workspace files
EXPORT_MIME_TYPES = {
    'application/vnd.google-apps.document': 'text/plain',
    'application/vnd.google-apps.spreadsheet': 'text/csv',
    'application/vnd.google-apps.presentation': 'text/plain',
}


class GoogleDriveService:
    """Service for Google Drive operations."""

    def __init__(self):
        self.client_id = settings.GOOGLE_CLIENT_ID
        self.client_secret = settings.GOOGLE_CLIENT_SECRET
        self.redirect_uri = settings.GOOGLE_REDIRECT_URI

    def _get_client_config(self) -> Dict[str, Any]:
        """Get OAuth client configuration."""
        return {
            "web": {
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [self.redirect_uri]
            }
        }

    def get_auth_url(self, state: Optional[str] = None) -> str:
        """
        Generate OAuth authorization URL.

        Args:
            state: Optional state parameter for security

        Returns:
            Authorization URL to redirect user to
        """
        flow = Flow.from_client_config(
            self._get_client_config(),
            scopes=SCOPES,
            redirect_uri=self.redirect_uri
        )

        auth_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent',
            state=state
        )

        return auth_url

    def exchange_code(self, code: str) -> Dict[str, Any]:
        """
        Exchange authorization code for tokens.

        Args:
            code: Authorization code from OAuth callback

        Returns:
            Token data including access_token and refresh_token
        """
        flow = Flow.from_client_config(
            self._get_client_config(),
            scopes=SCOPES,
            redirect_uri=self.redirect_uri
        )

        flow.fetch_token(code=code)
        credentials = flow.credentials

        return {
            'access_token': credentials.token,
            'refresh_token': credentials.refresh_token,
            'token_uri': credentials.token_uri,
            'client_id': credentials.client_id,
            'client_secret': credentials.client_secret,
            'scopes': list(credentials.scopes) if credentials.scopes else SCOPES,
            'expiry': credentials.expiry.isoformat() if credentials.expiry else None
        }

    def _get_drive_service(self, token_data: Dict[str, Any]):
        """
        Create Drive API service from token data.

        Args:
            token_data: OAuth token data

        Returns:
            Google Drive API service
        """
        credentials = Credentials(
            token=token_data['access_token'],
            refresh_token=token_data.get('refresh_token'),
            token_uri=token_data.get('token_uri', 'https://oauth2.googleapis.com/token'),
            client_id=token_data.get('client_id', self.client_id),
            client_secret=token_data.get('client_secret', self.client_secret),
            scopes=token_data.get('scopes', SCOPES)
        )

        return build('drive', 'v3', credentials=credentials)

    def list_files(
        self,
        token_data: Dict[str, Any],
        folder_id: Optional[str] = None,
        page_token: Optional[str] = None,
        page_size: int = 50,
        search_query: Optional[str] = None,
        order_by: str = "modifiedTime desc"
    ) -> Dict[str, Any]:
        """
        List files from Google Drive.

        Args:
            token_data: OAuth token data
            folder_id: Optional folder ID to list files from
            page_token: Token for pagination
            page_size: Number of files per page
            search_query: Optional search term to filter files by name
            order_by: Sort order (modifiedTime desc, name, name desc, createdTime desc)

        Returns:
            Dict with files list and next page token
        """
        service = self._get_drive_service(token_data)

        # Build query
        query_parts = ["trashed = false"]
        if folder_id and not search_query:
            # Only filter by folder if not searching (search is global)
            query_parts.append(f"'{folder_id}' in parents")
        if search_query:
            # Search by name containing the query
            escaped_query = search_query.replace("'", "\\'")
            query_parts.append(f"name contains '{escaped_query}'")

        query = " and ".join(query_parts)

        # Validate order_by to prevent injection
        valid_orders = ["modifiedTime desc", "modifiedTime", "name", "name desc", "createdTime desc", "createdTime"]
        if order_by not in valid_orders:
            order_by = "modifiedTime desc"

        try:
            results = service.files().list(
                q=query,
                pageSize=page_size,
                pageToken=page_token,
                fields="nextPageToken, files(id, name, mimeType, webViewLink, modifiedTime, size, parents)",
                orderBy=order_by
            ).execute()

            files = results.get('files', [])
            next_page_token = results.get('nextPageToken')

            # Filter and format files
            formatted_files = []
            for file in files:
                mime_type = file.get('mimeType', '')
                is_folder = mime_type == 'application/vnd.google-apps.folder'
                is_supported = mime_type in SUPPORTED_MIME_TYPES or is_folder

                formatted_files.append({
                    'id': file['id'],
                    'name': file['name'],
                    'mimeType': mime_type,
                    'isFolder': is_folder,
                    'isSupported': is_supported,
                    'fileType': SUPPORTED_MIME_TYPES.get(mime_type, 'Folder' if is_folder else 'Unknown'),
                    'webViewLink': file.get('webViewLink'),
                    'modifiedTime': file.get('modifiedTime'),
                    'size': file.get('size'),
                })

            return {
                'files': formatted_files,
                'nextPageToken': next_page_token
            }

        except HttpError as e:
            raise Exception(f"Error listing files: {e}")

    def get_file_content(
        self,
        token_data: Dict[str, Any],
        file_id: str
    ) -> Dict[str, Any]:
        """
        Get file content and metadata.

        Args:
            token_data: OAuth token data
            file_id: Google Drive file ID

        Returns:
            Dict with file metadata and text content
        """
        service = self._get_drive_service(token_data)

        try:
            # Get file metadata
            file_metadata = service.files().get(
                fileId=file_id,
                fields="id, name, mimeType, webViewLink, modifiedTime, size"
            ).execute()

            mime_type = file_metadata.get('mimeType', '')
            content = ""

            # Extract text content based on file type
            if mime_type in EXPORT_MIME_TYPES:
                # Google Workspace files - export as text
                export_mime = EXPORT_MIME_TYPES[mime_type]
                response = service.files().export(
                    fileId=file_id,
                    mimeType=export_mime
                ).execute()
                content = response.decode('utf-8') if isinstance(response, bytes) else response

            elif mime_type in ['text/plain', 'text/html', 'text/markdown']:
                # Text files - download directly
                response = service.files().get_media(fileId=file_id).execute()
                content = response.decode('utf-8') if isinstance(response, bytes) else response

            elif mime_type == 'application/pdf':
                # PDF - download and parse with document parser
                try:
                    from app.services.document_parser import document_parser
                    response = service.files().get_media(fileId=file_id).execute()
                    if response:
                        _, content, _ = document_parser.parse_file(response, file_metadata['name'])
                        # Remove null characters that cause database issues
                        content = content.replace('\x00', '').replace('\u0000', '')
                except Exception as e:
                    content = f"[Error extracting PDF: {str(e)}]"

            elif mime_type in ['application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                               'application/msword']:
                # Word document - download and parse
                try:
                    from app.services.document_parser import document_parser
                    response = service.files().get_media(fileId=file_id).execute()
                    if response:
                        _, content, _ = document_parser.parse_file(response, file_metadata['name'])
                        # Remove null characters that cause database issues
                        content = content.replace('\x00', '').replace('\u0000', '')
                except Exception as e:
                    content = f"[Error extracting Word document: {str(e)}]"

            elif mime_type in ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                               'application/vnd.ms-excel']:
                # Excel - for now just note it's not fully supported
                content = f"[Excel file - text extraction limited]"

            elif mime_type in ['application/vnd.openxmlformats-officedocument.presentationml.presentation',
                               'application/vnd.ms-powerpoint']:
                # PowerPoint - for now just note it's not fully supported
                content = f"[PowerPoint file - text extraction limited]"

            elif mime_type == 'message/rfc822':
                # Email (.eml) - download and parse
                try:
                    from app.services.document_parser import document_parser
                    response = service.files().get_media(fileId=file_id).execute()
                    if response:
                        _, content, _ = document_parser.parse_file(response, file_metadata['name'])
                        # Remove null characters that cause database issues
                        content = content.replace('\x00', '').replace('\u0000', '')
                except Exception as e:
                    content = f"[Error extracting email: {str(e)}]"

            elif mime_type in AUDIO_MIME_TYPES:
                # Audio files - download and transcribe with Whisper
                try:
                    from app.services.audio_transcriber import audio_transcriber
                    if not audio_transcriber.is_available():
                        content = "[Audio transcription not available - OPENAI_API_KEY not configured]"
                    else:
                        response = service.files().get_media(fileId=file_id).execute()
                        if response:
                            # Check file size
                            if len(response) > audio_transcriber.MAX_FILE_SIZE:
                                content = f"[Audio file too large for transcription - max {audio_transcriber.MAX_FILE_SIZE // (1024*1024)}MB]"
                            else:
                                transcription, detected_lang = audio_transcriber.transcribe(
                                    response,
                                    file_metadata['name']
                                )
                                content = transcription
                                # Remove null characters that cause database issues
                                content = content.replace('\x00', '').replace('\u0000', '')
                        else:
                            content = "[Error downloading audio file]"
                except Exception as e:
                    content = f"[Error transcribing audio: {str(e)}]"

            else:
                # Other files - get metadata only
                content = f"[{SUPPORTED_MIME_TYPES.get(mime_type, 'Unknown')} file - content extraction not supported]"

            return {
                'id': file_metadata['id'],
                'name': file_metadata['name'],
                'mimeType': mime_type,
                'fileType': SUPPORTED_MIME_TYPES.get(mime_type, 'Unknown'),
                'webViewLink': file_metadata.get('webViewLink'),
                'modifiedTime': file_metadata.get('modifiedTime'),
                'content': content
            }

        except HttpError as e:
            raise Exception(f"Error getting file content: {e}")

    def get_folder_path(
        self,
        token_data: Dict[str, Any],
        folder_id: str
    ) -> List[Dict[str, str]]:
        """
        Get folder path (breadcrumb) from root to specified folder.

        Args:
            token_data: OAuth token data
            folder_id: Folder ID to get path for

        Returns:
            List of folder dicts with id and name, from root to current
        """
        service = self._get_drive_service(token_data)
        path = []
        current_id = folder_id

        try:
            while current_id:
                folder = service.files().get(
                    fileId=current_id,
                    fields="id, name, parents"
                ).execute()

                path.insert(0, {
                    'id': folder['id'],
                    'name': folder['name']
                })

                parents = folder.get('parents', [])
                current_id = parents[0] if parents else None

                # Safety limit
                if len(path) > 20:
                    break

            return path

        except HttpError as e:
            # Root folder or error
            return path


# Singleton instance
google_drive_service = GoogleDriveService()
