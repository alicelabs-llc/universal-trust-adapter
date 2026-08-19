$f1='e-voting/voting-server/src/main/java/ch/post/it/evoting/votingserver/process/voting/confirmvote/ConfirmVoteController.java'
$f2='e-voting/voting-server/src/main/java/ch/post/it/evoting/votingserver/idempotence/IdempotenceService.java'
$f3='crypto-primitives/src/main/java/ch/post/it/evoting/cryptoprimitives/collection/ImmutableByteArray.java'

$h1 = Select-String -Path $f1 -Pattern '@PostMapping|retrieveShortVoteCastReturnCode|idempotenceService.execute' |
  ForEach-Object { "{0}:{1}: {2}" -f $_.Path,$_.LineNumber,$_.Line.Trim() }
$h1 | Set-Content 'evidence/bugbounty/timing_path/01_confirmvote_controller_hits.txt' -Encoding utf8

$h2 = Select-String -Path $f2 -Pattern 'payloadHash.equals\(executedPayloadHash\)|recursiveHash\(|execute\(' |
  ForEach-Object { "{0}:{1}: {2}" -f $_.Path,$_.LineNumber,$_.Line.Trim() }
$h2 | Set-Content 'evidence/bugbounty/timing_path/02_idempotence_hits.txt' -Encoding utf8

$h3 = Select-String -Path $f3 -Pattern 'public boolean equals|Arrays.equals\(' |
  ForEach-Object { "{0}:{1}: {2}" -f $_.Path,$_.LineNumber,$_.Line.Trim() }
$h3 | Set-Content 'evidence/bugbounty/timing_path/03_immutablebytearray_hits.txt' -Encoding utf8

'OK' | Set-Content 'evidence/bugbounty/logs/extract_path_status.txt' -Encoding utf8