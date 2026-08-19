import json, time, statistics, urllib.request, urllib.error
from pathlib import Path

BASE='http://localhost:8080'
PATH='/api/v1/processor/voting/confirmvote/electionevent/{ee}/verificationcardset/{vcs}/credentialId/{cred}/verificationcard/{vc}'

EE='00000000-0000-0000-0000-000000000001'
VCS='00000000-0000-0000-0000-000000000002'
CRED='00000000-0000-0000-0000-000000000003'
VC='00000000-0000-0000-0000-000000000004'

URL=BASE+PATH.format(ee=EE,vcs=VCS,cred=CRED,vc=VC)
OUT=Path('evidence/bugbounty/logs')
OUT.mkdir(parents=True,exist_ok=True)

# Two payload classes with same execution key fields but changed body values.
payload_a={
  'contextIds': {'electionEventId':EE,'verificationCardSetId':VCS,'verificationCardId':VC},
  'authenticationChallenge': {'derivedVoterIdentifier':CRED},
  'confirmationKey': 'A'*64
}
payload_b={
  'contextIds': {'electionEventId':EE,'verificationCardSetId':VCS,'verificationCardId':VC},
  'authenticationChallenge': {'derivedVoterIdentifier':CRED},
  'confirmationKey': 'B'*64
}

def req(payload):
  data=json.dumps(payload).encode('utf-8')
  r=urllib.request.Request(URL,data=data,method='POST',headers={'Content-Type':'application/json'})
  t0=time.perf_counter_ns()
  code,body='ERR',''
  try:
    with urllib.request.urlopen(r,timeout=5) as resp:
      code=resp.getcode(); body=resp.read(200).decode('utf-8','ignore')
  except urllib.error.HTTPError as e:
    code=e.code
    try: body=e.read(200).decode('utf-8','ignore')
    except: body=''
  except Exception as e:
    body=str(e)
  dt=time.perf_counter_ns()-t0
  return dt,code,body

def collect(payload,n=60,warmup=10):
  for _ in range(warmup): req(payload)
  times=[]; codes=[]
  for _ in range(n):
    dt,code,body=req(payload)
    times.append(dt); codes.append(code)
  return times,codes

# quick connectivity check
probe_dt, probe_code, probe_body = req(payload_a)
if probe_code == 'ERR':
  report={
    'url':URL,
    'status':'service_unreachable',
    'probe_error':probe_body,
    'next_step':'start voting-server locally and rerun this script'
  }
  (OUT/'timing_confirmvote_report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
  print(json.dumps(report,indent=2))
  raise SystemExit(0)

# run
A,cA=collect(payload_a,n=30,warmup=5)
B,cB=collect(payload_b,n=30,warmup=5)

report={
  'url':URL,
  'n':len(A),
  'codes_a':{str(k):cA.count(k) for k in sorted(set(cA),key=lambda x:str(x))},
  'codes_b':{str(k):cB.count(k) for k in sorted(set(cB),key=lambda x:str(x))},
  'mean_ns_a':statistics.mean(A),
  'mean_ns_b':statistics.mean(B),
  'stdev_ns_a':statistics.pstdev(A),
  'stdev_ns_b':statistics.pstdev(B),
  'delta_ns':statistics.mean(B)-statistics.mean(A)
}

(OUT/'timing_confirmvote_raw_a.json').write_text(json.dumps(A),encoding='utf-8')
(OUT/'timing_confirmvote_raw_b.json').write_text(json.dumps(B),encoding='utf-8')
(OUT/'timing_confirmvote_report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))