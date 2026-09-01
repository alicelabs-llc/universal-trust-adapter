-- UTA — Lua example: verify a credential via public HTTP API.
-- Repo: https://github.com/alicelabs-llc/universal-trust-adapter

local card = arg and arg[1] or error('Usage: lua verify.lua <card-string>')
local http = require('socket.http')
local ltn12 = require('ltn12')
local json = require('dkjson')

local payload = json.encode({ card = card })
local response_body = {}

local _, status = http.request{
  url = 'https://www.marketnow.site/api/trust?action=verify',
  method = 'POST',
  headers = {
    ['Content-Type'] = 'application/json',
    ['Content-Length'] = #payload,
  },
  source = ltn12.source.string(payload),
  sink = ltn12.sink.table(response_body),
}

local body = table.concat(response_body)
local result = json.decode(body)
print('Decision:   ' .. (result.decision or '?'))
print('Format:     ' .. (result.detected_format or '?'))
print('Issuer:     ' .. (result.issuer or '?'))
