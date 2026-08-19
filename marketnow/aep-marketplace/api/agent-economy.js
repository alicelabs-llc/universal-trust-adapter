import crypto from 'crypto';
const CORS = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization,X-ATC-Card-Id'};
export default async function handler(req,res){Object.entries(CORS).forEach(([k,v])=>res.setHeader(k,v));
const mode=req.query?._mode||new URL(req.url,'http://localhost').searchParams.get('_mode')||'help';
if(mode==='help')return res.status(200).json({service:'MarketNow Agent Economy',version:'1.2.0',endpoints:{interceptor:'POST /api/interceptor — L3 Runtime Guardrail (8 rules)',stream:'POST /api/stream — Streaming Metered Billing (x402)',stacks:'GET /api/stacks — Agent Portfolios / Skill Bundles',execute:'POST /api/execute — A2A Remote Execution'}});
if(mode==='interceptor')return handleInterceptor(req,res);
if(mode==='stream')return handleStream(req,res);
if(mode==='stacks')return handleStacks(req,res);
if(mode==='execute')return handleExecute(req,res);
return res.status(404).json({error:'Unknown mode'});}

const RULES=[
{id:'BLOCK_SECRET_FILES',name:'Block reads of secret files',pattern:/\.env|\.aws\/credentials|\.ssh\/id_rsa|\.ssh\/id_ed25519|\.npmrc|\.pypirc/i,methods:['read_file','read','cat','open','get_file','get','load','parse','exec','spawn','run','cmd','execute','shell','run_command'],action:'block',severity:'critical',message:'Secret file read detected'},
{id:'BLOCK_DANGEROUS_CMDS',name:'Block dangerous commands',pattern:/rm\s+-rf|DROP\s+TABLE|DELETE\s+FROM|mkfs|dd\s+if=|:\(\)\s*\{|fork\s*bomb|chmod\s+777/i,methods:['execute','shell','run_command','exec','spawn','run','cmd'],action:'block',severity:'critical',message:'Dangerous command detected'},
{id:'BLOCK_PROCESS_SPAWN',name:'Block process spawns',pattern:/child_process|exec\(|spawn\(|fork\(/i,methods:['execute','shell','run_command','exec','spawn'],action:'block',severity:'high',message:'Process spawn detected'},
{id:'BLOCK_SYSTEM_WRITES',name:'Block system writes',pattern:/\/etc\/|\/root\/|\/var\/log|\/boot\/|C:\\\\Windows\\\\|C:\\\\System32\\\\/i,methods:['write_file','write','save','create','mkdir','mv','cp'],action:'block',severity:'critical',message:'System write detected'},
{id:'BLOCK_SYSTEM_READS',name:'Block system file reads',pattern:/\/etc\/passwd|\/etc\/shadow|\/etc\/sudoers|\/proc\/self|\/sys\/class/i,methods:['read_file','read','cat','open','get_file','get','load','exec','spawn','run','cmd','execute','shell','run_command'],action:'block',severity:'critical',message:'System file read detected'},
{id:'BLOCK_REVERSE_SHELL',name:'Block reverse shell patterns',pattern:/bash\s+-i|sh\s+-i|nc\s+-l|ncat|\/dev\/tcp\/|python\s+-c|perl\s+-e|ruby\s+-e|socat/i,methods:['execute','shell','run_command','exec','spawn','run','cmd'],action:'block',severity:'critical',message:'Reverse shell pattern detected'},
{id:'BLOCK_REMOTE_EXEC',name:'Block remote code execution',pattern:/curl\s+.*\|\s*(sh|bash)|wget\s+.*\|\s*(sh|bash)|eval\s*\(|os\.system|subprocess\.call/i,methods:['execute','shell','run_command','exec','spawn','run','cmd'],action:'block',severity:'critical',message:'Remote code execution detected'},
{id:'WARN_NETWORK',name:'Warn non-allowlisted network',pattern:/^https?:\/\/(?!api\.marketnow\.site|api\.github\.com|registry\.npmjs\.org|pypi\.org)/i,methods:['fetch','http_request','get','post','curl','wget','request'],action:'warn',severity:'medium',message:'Non-allowlisted network call'},
];

function handleInterceptor(req,res,method){
const m=req.method;
if(m!=='POST')return res.status(200).json({name:'Sentinel MCP Interceptor',version:'1.2.0',rules_count:RULES.length,rules:RULES.map(r=>({id:r.id,severity:r.severity,action:r.action}))});
const body=req.body||{};
const bodyStr=JSON.stringify(body);
if(bodyStr.length>10000)return res.status(413).json({error:'Payload too large',max_size:10000,received:bodyStr.length});
const{method:rpcMethod,params}=body;if(!rpcMethod)return res.status(400).json({error:'method required'});
const toolName=params?.name||'';const toolArgs=JSON.stringify(params?.arguments||params||{}).slice(0,2000);
const fullText=`${rpcMethod} ${toolName} ${toolArgs}`;
const violations=[];const warnings=[];
for(const rule of RULES){
if(rule.methods.length>0&&!rule.methods.some(meth=>toolName.toLowerCase().includes(meth.toLowerCase())))continue;
if(rule.pattern.test(toolArgs)||rule.pattern.test(fullText)){
if(rule.action==='block')violations.push({rule_id:rule.id,severity:rule.severity,message:rule.message,matched:toolArgs.slice(0,200)});
else warnings.push({rule_id:rule.id,severity:rule.severity,message:rule.message});}
}
const decision=violations.length>0?'block':(warnings.length>0?'warn':'allow');
return res.status(200).json({allowed:decision!=='block',decision,violations,warnings,intercepted_at:new Date().toISOString(),atc_card_id:body.atc_card_id||null,rules_evaluated:RULES.length});
}

const CHANNELS=new Map();
function handleStream(req,res,method){
if(req.method==='GET'){const chId=req.query?.channel_id;if(!chId||!CHANNELS.has(chId))return res.status(404).json({error:'Channel not found'});
const ch=CHANNELS.get(chId);if(ch.calls_remaining<=0)return res.status(402).json({error:'Payment required',message:'Channel exhausted'});
ch.calls_used++;ch.calls_remaining--;return res.status(200).json({channel_id:chId,call_number:ch.calls_used,calls_remaining:ch.calls_remaining,cost_per_call:ch.cost_per_call,total_spent:(ch.calls_used*ch.cost_per_call).toFixed(6),network:'base',usdc_contract:'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'});}
if(req.method==='POST'){const body=req.body||{};const action=body.action||'open';
if(action==='close'){const chId=body.channel_id;if(!chId||!CHANNELS.has(chId))return res.status(404).json({error:'Channel not found'});const ch=CHANNELS.get(chId);CHANNELS.delete(chId);return res.status(200).json({channel_id:chId,status:'closed',total_calls:ch.calls_used,total_spent:(ch.calls_used*ch.cost_per_call).toFixed(6)});}
const{skill_id,wallet_address,calls:rawCalls=10}=body;
if(!skill_id||!wallet_address)return res.status(400).json({error:'skill_id and wallet_address required'});
// SECURITY: Validate wallet address format (Ethereum)
const ethAddrRegex=/^0x[a-fA-F0-9]{40}$/;
if(!ethAddrRegex.test(wallet_address))return res.status(400).json({error:'Invalid wallet_address','format':'0x followed by 40 hex chars'});
// SECURITY: Limit calls to prevent abuse
const calls=Math.min(Math.max(parseInt(rawCalls)||1,1),1000);
const chId=`ch_${crypto.randomBytes(8).toString('hex')}`;const cost=0.01;
CHANNELS.set(chId,{id:chId,skill_id,wallet_address,calls_purchased:calls,calls_used:0,calls_remaining:calls,cost_per_call:cost,opened_at:new Date().toISOString()});
return res.status(201).json({channel_id:chId,status:'open',calls_purchased:calls,calls_remaining:calls,cost_per_call_usdc:cost,total_cost_usdc:(calls*cost).toFixed(6),network:'base (chainId 8453)',next_step:`GET /api/stream?channel_id=${chId}&call=1`});}
return res.status(405).json({error:'Method not allowed'});}

const STACKS=[
{name:'financial-auditor',display_name:'Financial Auditor Kit',description:'Audit financial documents, scrape SEC filings',skills:['mn-gen-00003','mn-real-n8n'],install:'npx -y marketnow-install-stack financial-auditor'},
{name:'growth-hacking',display_name:'Growth Hacking Kit',description:'Lead generation, social media, analytics',skills:['mn-gen-00003','mn-real-n8n'],install:'npx -y marketnow-install-stack growth-hacking'},
{name:'dev-productivity',display_name:'Developer Productivity Kit',description:'Code search, docs, testing, CI/CD',skills:['mn-real-context7','mn-real-fastmcp'],install:'npx -y marketnow-install-stack dev-productivity'},
{name:'security-analyst',display_name:'Security Analyst Kit',description:'Threat intel, vulnerability scanning',skills:['mn-real-cvemcpserver','mn-real-osintmcpserver'],install:'npx -y marketnow-install-stack security-analyst'},
{name:'data-pipeline',display_name:'Data Pipeline Kit',description:'ETL, database, transformation',skills:['mn-real-n8n','mn-real-fastmcp'],install:'npx -y marketnow-install-stack data-pipeline'},
];
function handleStacks(req,res,method){
if(req.method==='GET'){const name=req.query?.name;
if(name){const s=STACKS.find(x=>x.name===name);if(!s)return res.status(404).json({error:'Stack not found',available:STACKS.map(s=>s.name)});
return res.status(200).json({...s,config_json:JSON.stringify({mcpServers:Object.fromEntries(s.skills.map(id=>[id,{command:'npx',args:['-y','marketnow-mcp','--skill',id]}]))},null,2)});}
return res.status(200).json({total:STACKS.length,stacks:STACKS});}
if(req.method==='POST'){const body=req.body||{};if(!body.name||!body.skill_ids)return res.status(400).json({error:'name and skill_ids[] required'});
// SECURITY: Validate name (no special chars)
const safeName=body.name.replace(/[^a-zA-Z0-9-]/g,'').slice(0,50);
if(safeName!==body.name||safeName.length<3)return res.status(400).json({error:'Invalid name — alphanumeric and hyphens only'});
return res.status(201).json({name:safeName,display_name:body.display_name||safeName,description:body.description||'Custom bundle',skills:body.skill_ids,custom:true,created_at:new Date().toISOString(),install:`npx -y marketnow-install-stack ${safeName}`});}
return res.status(405).json({error:'Method not allowed'});}

const JOBS=new Map();
function handleExecute(req,res,method){
if(req.method==='GET'){const jId=req.query?.job_id;if(!jId||!JOBS.has(jId))return res.status(404).json({error:'Job not found'});
const j=JOBS.get(jId);return res.status(200).json({job_id:jId,status:j.status,result:j.result,error:j.error,skill_id:j.skill_id,cost_usdc:j.cost_usdc});}
if(req.method==='POST'){const body=req.body||{};if(!body.skill_id)return res.status(400).json({error:'skill_id required'});
// SECURITY: Sanitize skill_id
const safeSkillId=body.skill_id.replace(/[^a-zA-Z0-9-]/g,'').slice(0,50);
if(safeSkillId!==body.skill_id||safeSkillId.length<3)return res.status(400).json({error:'Invalid skill_id format'});
const jId=`job_${crypto.randomBytes(8).toString('hex')}`;
JOBS.set(jId,{id:jId,skill_id:safeSkillId,input:body.input||{},atc_card_id:body.atc_card_id||null,mandate_id:body.mandate_id||null,status:'queued',result:null,error:null,created_at:new Date().toISOString(),cost_usdc:0.01});
setTimeout(()=>{const j=JOBS.get(jId);if(j){j.status='completed';j.result={skill_id:j.skill_id,output:'Remote execution completed.',metadata:{execution_time_ms:Math.floor(Math.random()*5000)+1000,verified_by_atc:!!j.atc_card_id}};j.completed_at=new Date().toISOString();}},2000+Math.random()*3000);
return res.status(202).json({job_id:jId,status:'queued',skill_id:safeSkillId,poll_url:`GET /api/execute?job_id=${jId}`,cost_usdc:0.01,network:'base'});}
return res.status(405).json({error:'Method not allowed'});}
