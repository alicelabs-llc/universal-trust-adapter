$controllers = Get-ChildItem -Recurse -Path 'e-voting/voting-server/src/main/java' -Filter *.java |
  Where-Object { Select-String -Path $_.FullName -Pattern '@RestController|@Controller' -Quiet }

$out = @()
foreach($c in $controllers){
  $hasIdempo = Select-String -Path $c.FullName -Pattern 'idempotenceService\.execute\(' -Quiet
  if($hasIdempo){
    $pm = Select-String -Path $c.FullName -Pattern '@PostMapping|@PutMapping|@PatchMapping|@DeleteMapping|@RequestMapping'
    $id = Select-String -Path $c.FullName -Pattern 'idempotenceService\.execute\('
    foreach($p in $pm){ $out += ("{0}:{1}: {2}" -f $p.Path,$p.LineNumber,$p.Line.Trim()) }
    foreach($i in $id){ $out += ("{0}:{1}: {2}" -f $i.Path,$i.LineNumber,$i.Line.Trim()) }
    $out += '---'
  }
}
$out | Set-Content 'evidence/bugbounty/timing_path/04_idempotence_endpoint_map.txt' -Encoding utf8
(Get-Content 'evidence/bugbounty/timing_path/04_idempotence_endpoint_map.txt' | Measure-Object).Count | Set-Content 'evidence/bugbounty/logs/idempotence_endpoint_map_count.txt' -Encoding utf8