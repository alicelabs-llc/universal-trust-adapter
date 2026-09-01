<?php
/**
 * UTA — PHP example: verify a credential via public HTTP API.
 * Repo: https://github.com/alicelabs-llc/universal-trust-adapter
 */
$card = $argv[1] ?? die("Usage: php verify.php <card-string>\n");
$ch = curl_init('https://www.marketnow.site/api/trust?action=verify');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode(['card' => $card]),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10,
]);
$response = curl_exec($ch);
curl_close($ch);
$result = json_decode($response, true);
echo "Decision:   {$result['decision']}\n";
echo "Format:     {$result['detected_format']}\n";
echo "Issuer:     {$result['issuer']}\n";
exit(match($result['decision']) {
    'PERMIT' => 0, 'DENY' => 1, default => 2,
});
