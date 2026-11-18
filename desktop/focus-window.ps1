param([int]$PetProcessId=0)
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class FocusWindow {
 public static System.Collections.Concurrent.ConcurrentQueue<string> Commands=new System.Collections.Concurrent.ConcurrentQueue<string>();
 public static volatile bool Done=false;
 public static void StartInput(){var t=new System.Threading.Thread(()=>{string s;while((s=Console.ReadLine())!=null)Commands.Enqueue(s);Done=true;});t.IsBackground=true;t.Start();}

 [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left,Top,Right,Bottom; }
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr w,int cmd);
 [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr w);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr w,out RECT r);
 [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr w,int n);
 [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr w,int n,int v);
 [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr w,IntPtr after,int x,int y,int cx,int cy,uint flags);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr w,out uint pid);
 [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr w);
}
"@
Add-Type -AssemblyName System.Windows.Forms
$target=[IntPtr]::Zero
$lastExternal=[IntPtr]::Zero
$wasZoomed=$false
$previousStyle=0
$previousRect=New-Object FocusWindow+RECT
try {
 [FocusWindow]::StartInput()
 while($true) {
  $current=[FocusWindow]::GetForegroundWindow()
  $currentPid=[uint32]0
  [void][FocusWindow]::GetWindowThreadProcessId($current,[ref]$currentPid)
  if($currentPid -ne $PetProcessId -and $currentPid -ne $PID -and $current -ne [IntPtr]::Zero){$lastExternal=$current}
  $command=''
  if(-not [FocusWindow]::Commands.TryDequeue([ref]$command)){if([FocusWindow]::Done){break};Start-Sleep -Milliseconds 50;continue}
  if($command -eq 'enter' -and $target -eq [IntPtr]::Zero){
   $candidate=[FocusWindow]::GetForegroundWindow()
   $targetPid=[uint32]0
   [void][FocusWindow]::GetWindowThreadProcessId($candidate,[ref]$targetPid)
   if($targetPid -eq $PetProcessId){$candidate=$lastExternal}
   if($candidate -eq [IntPtr]::Zero){continue}
   $target=$candidate
   [void][FocusWindow]::GetWindowRect($target,[ref]$previousRect)
   $wasZoomed=[FocusWindow]::IsZoomed($target)
   [void][FocusWindow]::ShowWindow($target,9)
   $previousStyle=[FocusWindow]::GetWindowLong($target,-16)
   $bounds=[System.Windows.Forms.Screen]::FromHandle($target).Bounds
   [void][FocusWindow]::SetWindowLong($target,-16,($previousStyle -band (-bnot 0x00C40000)))
   [void][FocusWindow]::SetWindowPos($target,[IntPtr]::Zero,$bounds.X,$bounds.Y,$bounds.Width,$bounds.Height,0x0034)
  } elseif($command -eq 'exit' -and $target -ne [IntPtr]::Zero){
   [void][FocusWindow]::SetWindowLong($target,-16,$previousStyle)
   [void][FocusWindow]::SetWindowPos($target,[IntPtr]::Zero,$previousRect.Left,$previousRect.Top,($previousRect.Right-$previousRect.Left),($previousRect.Bottom-$previousRect.Top),0x0034)
   if($wasZoomed){[void][FocusWindow]::ShowWindow($target,3)}
   $target=[IntPtr]::Zero
  }
 }
} finally {
 if($target -ne [IntPtr]::Zero -and [FocusWindow]::IsWindow($target)){
  [void][FocusWindow]::SetWindowLong($target,-16,$previousStyle)
  [void][FocusWindow]::SetWindowPos($target,[IntPtr]::Zero,$previousRect.Left,$previousRect.Top,($previousRect.Right-$previousRect.Left),($previousRect.Bottom-$previousRect.Top),0x0034)
 }
}
