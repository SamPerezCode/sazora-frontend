import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { ESLint } from 'eslint';

const bundle = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(bundle, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(bundle, 'manifest.json'), 'utf8'));
const normalize = p => path.resolve(p).replaceAll('\\', '/').toLowerCase();
const patches = new Map(manifest.map(({file}) => [normalize(path.join(root,file)), fs.readFileSync(path.join(bundle,file),'utf8')]));
const config = ts.readConfigFile(path.join(root,'tsconfig.app.json'), ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
const host = ts.createCompilerHost(parsed.options);
const read=host.readFile, exists=host.fileExists, directory=host.directoryExists;
host.readFile = p => patches.get(normalize(p)) ?? read(p);
host.fileExists = p => patches.has(normalize(p)) || exists(p);
host.directoryExists = p => [...patches.keys()].some(file => file.startsWith(normalize(p)+'/')) || directory(p);
const program=ts.createProgram([...new Set([...parsed.fileNames,...manifest.map(({file})=>path.join(root,file))])],{...parsed.options,noEmit:true,incremental:false},host);
const diagnostics=ts.getPreEmitDiagnostics(program);
console.log(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:()=>root,getCanonicalFileName:p=>p,getNewLine:()=>'\n'}));
console.log('TypeScript:', diagnostics.length);
const eslint=new ESLint({cwd:root});
let count=0;
for(const {file} of manifest){
  const results=await eslint.lintText(fs.readFileSync(path.join(bundle,file),'utf8'),{filePath:path.join(root,file)});
  const messages=results.flatMap(r=>r.messages); count+=messages.length;
  if(messages.length)console.log(file,JSON.stringify(messages,null,2));
}
console.log('ESLint:',count);
if(diagnostics.length || count)process.exitCode=1;
