import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
const base={...process.env,NODE_ENV:'production',HOST:'',PORT:'10000',API_PORT:'3001',APP_URL:'',RENDER_EXTERNAL_URL:'https://notes.example.test',DATABASE_URL:'postgresql://test:test@database/notes',MAIL_TRANSPORT:'disabled',SMTP_HOST:''};
function run(overrides,code) { return spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:process.cwd(),env:{...base,...overrides},encoding:'utf8',windowsHide:true}); }
const check="const {config,validateConfig}=await import('./build/api/config.js');validateConfig();console.log(JSON.stringify({host:config.host,port:config.port,url:config.appUrl}));";
const valid=run({},check);assert.equal(valid.status,0,valid.stderr);assert.deepEqual(JSON.parse(valid.stdout.trim().split('\n').at(-1)),{host:'0.0.0.0',port:10000,url:'https://notes.example.test'});
for(const values of [{MAIL_TRANSPORT:'file'},{DATABASE_URL:''},{RENDER_EXTERNAL_URL:'http://notes.example.test'},{PORT:'invalid'},{MAIL_TRANSPORT:'smtp',SMTP_HOST:''}]) assert.notEqual(run(values,check).status,0,'Unsafe production configuration was accepted.');
assert.equal(run({},"const {sendVerification}=await import('./build/api/mail.js');try{await sendVerification('test@example.test','https://notes.example.test');process.exitCode=1;}catch{process.exitCode=0;}").status,0);
assert.equal(run({MAIL_TRANSPORT:'smtp',SMTP_HOST:'smtp.example.test',SMTP_PORT:'2525',SMTP_SECURE:'false'},"import assert from 'node:assert/strict';const mailer=(await import('nodemailer')).default;mailer.createTransport=(options)=>{assert.equal(options.requireTLS,true);assert.equal(options.secure,false);assert.equal(options.port,2525);return {sendMail:async()=>({})};};const {sendVerification}=await import('./build/api/mail.js');await sendVerification('test@example.test','https://notes.example.test');").status,0);
assert.equal(fs.existsSync('build/web/robots.txt'),true);
assert.equal(fs.existsSync('build/web/rubric-preview.htm'),false);
assert.equal(fs.existsSync('build/web/rubric-preview_files'),false);
console.log('PASS: hosting port/origin, HTTPS/database requirements, disabled mail failure, public build excludes rubric previews.');
