' SammyOS Silent Launcher
' Double-click this file — no cmd window, no terminal flicker.
' launch.py handles everything; a popup only appears on error.

Dim fso, scriptDir, pyScript, python, shell, result

Set fso      = CreateObject("Scripting.FileSystemObject")
Set shell    = CreateObject("WScript.Shell")
scriptDir    = fso.GetParentFolderName(WScript.ScriptFullName)
pyScript     = scriptDir & "\launch.py"

' Try "pythonw" first (suppresses the console window natively).
' Fall back to "python" if pythonw isn't on PATH.
python = "pythonw"
If shell.Run("pythonw --version", 0, True) <> 0 Then
    python = "python"
End If

' 0 = hide window, True = wait for exit
result = shell.Run(python & " """ & pyScript & """", 0, True)

If result <> 0 Then
    Dim logPath, msg
    logPath = scriptDir & "\launcher.log"
    msg = "SammyOS failed to launch (exit code " & result & ")."
    If fso.FileExists(logPath) Then
        msg = msg & Chr(13) & Chr(10) & Chr(13) & Chr(10) & _
              "Check launcher.log in your SammyOS folder for details."
    End If
    MsgBox msg, 16, "SammyOS Launcher"
End If