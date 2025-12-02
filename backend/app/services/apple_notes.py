"""
Apple Notes integration service using AppleScript.
Allows fetching folders and notes from Apple Notes on macOS.
"""
import subprocess
import json
import re
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime


class AppleNotesFolder(BaseModel):
    """Represents an Apple Notes folder."""
    id: str
    name: str
    note_count: int


class AppleNote(BaseModel):
    """Represents an Apple Note."""
    id: str
    name: str
    folder: str
    creation_date: Optional[str] = None
    modification_date: Optional[str] = None
    body: Optional[str] = None


class AppleNotesService:
    """Service for interacting with Apple Notes via AppleScript."""

    def _run_applescript(self, script: str) -> str:
        """Execute an AppleScript and return the result."""
        try:
            result = subprocess.run(
                ['osascript', '-e', script],
                capture_output=True,
                text=True,
                timeout=60
            )
            if result.returncode != 0:
                raise Exception(f"AppleScript error: {result.stderr}")
            return result.stdout.strip()
        except subprocess.TimeoutExpired:
            raise Exception("AppleScript timed out")
        except Exception as e:
            raise Exception(f"Failed to execute AppleScript: {str(e)}")

    def get_folders(self) -> List[AppleNotesFolder]:
        """Get all folders from Apple Notes."""
        script = '''
        tell application "Notes"
            set folderList to {}
            repeat with f in folders
                set folderName to name of f
                set noteCount to count of notes of f
                set folderId to id of f
                set end of folderList to folderId & "|||" & folderName & "|||" & (noteCount as string)
            end repeat
            set AppleScript's text item delimiters to ":::"
            return folderList as string
        end tell
        '''

        result = self._run_applescript(script)

        if not result:
            return []

        folders = []
        for folder_str in result.split(":::"):
            if folder_str:
                parts = folder_str.split("|||")
                if len(parts) >= 3:
                    folders.append(AppleNotesFolder(
                        id=parts[0],
                        name=parts[1],
                        note_count=int(parts[2])
                    ))

        return folders

    def get_notes_in_folder(self, folder_name: str) -> List[AppleNote]:
        """Get all notes from a specific folder."""
        script = f'''
        tell application "Notes"
            set noteList to {{}}
            set targetFolder to folder "{folder_name}"
            repeat with n in notes of targetFolder
                set noteId to id of n
                set noteName to name of n
                set noteCreation to creation date of n
                set noteMod to modification date of n
                set end of noteList to noteId & "|||" & noteName & "|||" & "{folder_name}" & "|||" & (noteCreation as string) & "|||" & (noteMod as string)
            end repeat
            set AppleScript's text item delimiters to ":::"
            return noteList as string
        end tell
        '''

        result = self._run_applescript(script)

        if not result:
            return []

        notes = []
        for note_str in result.split(":::"):
            if note_str:
                parts = note_str.split("|||")
                if len(parts) >= 5:
                    notes.append(AppleNote(
                        id=parts[0],
                        name=parts[1],
                        folder=parts[2],
                        creation_date=parts[3],
                        modification_date=parts[4]
                    ))

        return notes

    def get_all_notes(self) -> List[AppleNote]:
        """Get all notes from all folders."""
        script = '''
        tell application "Notes"
            set noteList to {}
            repeat with f in folders
                set folderName to name of f
                repeat with n in notes of f
                    set noteId to id of n
                    set noteName to name of n
                    set noteCreation to creation date of n
                    set noteMod to modification date of n
                    set end of noteList to noteId & "|||" & noteName & "|||" & folderName & "|||" & (noteCreation as string) & "|||" & (noteMod as string)
                end repeat
            end repeat
            set AppleScript's text item delimiters to ":::"
            return noteList as string
        end tell
        '''

        result = self._run_applescript(script)

        if not result:
            return []

        notes = []
        for note_str in result.split(":::"):
            if note_str:
                parts = note_str.split("|||")
                if len(parts) >= 5:
                    notes.append(AppleNote(
                        id=parts[0],
                        name=parts[1],
                        folder=parts[2],
                        creation_date=parts[3],
                        modification_date=parts[4]
                    ))

        return notes

    def get_note_content(self, note_id: str) -> Optional[str]:
        """Get the HTML body of a specific note by ID."""
        # Escape quotes in ID
        escaped_id = note_id.replace('"', '\\"')

        script = f'''
        tell application "Notes"
            set targetNote to note id "{escaped_id}"
            return body of targetNote
        end tell
        '''

        try:
            result = self._run_applescript(script)
            return result
        except Exception:
            return None

    def get_note_by_id(self, note_id: str) -> Optional[AppleNote]:
        """Get a single note with its content by ID."""
        # AppleScript has issues with x-coredata:// URLs directly
        # Try using the ID directly first, then fall back to searching
        escaped_id = note_id.replace('"', '\\"').replace('\\', '\\\\')

        script = f'''
        tell application "Notes"
            try
                set n to note id "{escaped_id}"
                set noteId to id of n
                set noteName to name of n
                set noteFolder to name of container of n
                set noteCreation to creation date of n
                set noteMod to modification date of n
                set noteBody to body of n
                return noteId & "|||" & noteName & "|||" & noteFolder & "|||" & (noteCreation as string) & "|||" & (noteMod as string) & "|||" & noteBody
            on error
                return ""
            end try
        end tell
        '''

        try:
            result = self._run_applescript(script)
            if result:
                parts = result.split("|||", 5)  # Max 6 parts, body may contain |||
                if len(parts) >= 6:
                    return AppleNote(
                        id=parts[0],
                        name=parts[1],
                        folder=parts[2],
                        creation_date=parts[3],
                        modification_date=parts[4],
                        body=parts[5]
                    )
        except Exception:
            pass

        return None

    def get_note_by_name_and_folder(self, note_name: str, folder_name: str) -> Optional[AppleNote]:
        """Get a single note with its content by name and folder."""
        escaped_name = note_name.replace('"', '\\"')
        escaped_folder = folder_name.replace('"', '\\"')

        # Note: We use folder_name directly instead of "name of container of n"
        # because the latter fails when running from subprocess
        script = f'''
        tell application "Notes"
            try
                set targetFolder to folder "{escaped_folder}"
                repeat with n in notes of targetFolder
                    if name of n is "{escaped_name}" then
                        set noteId to id of n
                        set noteName to name of n
                        set noteCreation to creation date of n
                        set noteMod to modification date of n
                        set noteBody to body of n
                        return noteId & "|||" & noteName & "|||" & "{escaped_folder}" & "|||" & (noteCreation as string) & "|||" & (noteMod as string) & "|||" & noteBody
                    end if
                end repeat
                return ""
            on error
                return ""
            end try
        end tell
        '''

        try:
            result = self._run_applescript(script)
            if result:
                parts = result.split("|||", 5)
                if len(parts) >= 6:
                    return AppleNote(
                        id=parts[0],
                        name=parts[1],
                        folder=parts[2],
                        creation_date=parts[3],
                        modification_date=parts[4],
                        body=parts[5]
                    )
        except Exception:
            pass

        return None

    def get_notes_by_ids(self, note_ids: List[str]) -> List[AppleNote]:
        """Get multiple notes with their content by IDs."""
        notes = []
        for note_id in note_ids:
            note = self.get_note_by_id(note_id)
            if note:
                notes.append(note)
        return notes

    def html_to_text(self, html: str) -> str:
        """Convert HTML to plain text (simple version)."""
        if not html:
            return ""

        # Remove HTML tags
        text = re.sub(r'<br\s*/?>', '\n', html, flags=re.IGNORECASE)
        text = re.sub(r'</p>', '\n', text, flags=re.IGNORECASE)
        text = re.sub(r'</div>', '\n', text, flags=re.IGNORECASE)
        text = re.sub(r'</li>', '\n', text, flags=re.IGNORECASE)
        text = re.sub(r'<[^>]+>', '', text)

        # Decode HTML entities
        text = text.replace('&nbsp;', ' ')
        text = text.replace('&amp;', '&')
        text = text.replace('&lt;', '<')
        text = text.replace('&gt;', '>')
        text = text.replace('&quot;', '"')
        text = text.replace('&#39;', "'")

        # Clean up whitespace
        text = re.sub(r'\n\s*\n', '\n\n', text)
        text = text.strip()

        return text


# Singleton instance
apple_notes_service = AppleNotesService()
