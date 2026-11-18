import {useEffect,useRef,useState} from 'react';
import {CARDIO_REFERENCE_SAVE_KEY as KEY,CARDIO_REFERENCE_FRAGMENT,CARDIO_REFERENCE_FILE_LIMIT,readCardioReferenceSetup,
  validateCardioReferenceSetup,cardioReferenceFragment,type CardioReferenceSetup} from '../simulation/cardio-reference-design.js';

export default function CardioReferenceFiles({setup,onLoad,onPause}:{setup:CardioReferenceSetup|null;onLoad:(setup:CardioReferenceSetup)=>void;onPause:()=>void}){
  const upload=useRef<HTMLInputElement>(null),request=useRef(0);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const [shared,setShared]=useState<{url:string;signature:string}|null>(null);
  const signature=JSON.stringify(setup);
  useEffect(()=>{setError('');},[signature]);
  useEffect(()=>{
    const openShared=()=>{
      const raw=new URLSearchParams(location.hash.slice(1)).get(CARDIO_REFERENCE_FRAGMENT);if(raw===null)return;
      request.current++;setError('');setNotice('');setShared(null);
      try{onLoad(readCardioReferenceSetup(raw));setNotice('Shared reference opened.');}
      catch(error){setError('Shared reference rejected: '+(error as Error).message);}
    };
    openShared();window.addEventListener('hashchange',openShared);
    return()=>{request.current++;window.removeEventListener('hashchange',openShared);};
  },[]);
  const clearMessage=()=>{setError('');setNotice('');};
  const clearReferenceHash=()=>{const url=new URL(location.href);const hash=new URLSearchParams(url.hash.slice(1));hash.delete(CARDIO_REFERENCE_FRAGMENT);url.hash=hash.toString();history.replaceState(null,'',url);};
  const adopt=(next:CardioReferenceSetup,message:string)=>{onLoad(next);clearReferenceHash();setShared(null);setNotice(message);};
  const save=()=>{
    if(!setup)return;onPause();clearMessage();
    try{localStorage.setItem(KEY,JSON.stringify(validateCardioReferenceSetup(setup)));setNotice('Reference saved in this browser.');}
    catch(error){setError('Reference could not be saved: '+(error as Error).message);}
  };
  const load=()=>{
    clearMessage();request.current++;
    try{const text=localStorage.getItem(KEY);if(text===null)throw Error('No reference has been saved in this browser yet.');adopt(readCardioReferenceSetup(text),'Saved reference loaded.');}
    catch(error){setError((error as Error).message);}
  };
  const share=async()=>{
    if(!setup)return;onPause();clearMessage();
    const url=location.origin+'/lab/cardio/'+cardioReferenceFragment(setup);setShared({url,signature});history.replaceState(null,'',url);
    try{await navigator.clipboard.writeText(url);setNotice('Reference link copied.');}catch{setNotice('Copy the reference link below.');}
  };
  const download=()=>{
    if(!setup)return;onPause();clearMessage();
    const url=URL.createObjectURL(new Blob([JSON.stringify(validateCardioReferenceSetup(setup),null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='cardio-reference.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const accept=async(file?:File)=>{
    if(!file)return;onPause();clearMessage();const id=++request.current;
    try{if(file.size>CARDIO_REFERENCE_FILE_LIMIT)throw Error('Reference file exceeds 16 KB.');const next=readCardioReferenceSetup(await file.text());if(id!==request.current)return;adopt(next,'Reference imported. Save to keep it in this browser.');}
    catch(error){if(id===request.current)setError((error as Error).message);}
    finally{if(id===request.current&&upload.current)upload.current.value='';}
  };
  return <section className="cardio-reference-files" aria-label="Reference files and sharing">
    <div className="cardio-reference-file-actions">
      <button disabled={!setup} onClick={save}>Save reference</button><button onClick={load}>Load reference</button>
      <button disabled={!setup} onClick={share}>Share reference</button>
      <details><summary>Reference files</summary><div><button disabled={!setup} onClick={download}>Export reference</button><button onClick={()=>upload.current?.click()}>Import reference</button></div></details>
    </div>
    <input ref={upload} hidden type="file" accept=".json,application/json" aria-label="Import reference file" onChange={event=>accept(event.target.files?.[0])}/>
    <p>Save geometry and phase here, or use a link or file in another browser. Loading opens a paused reference and recalculates its selected trace.</p>
    {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
    {shared&&shared.signature===signature&&<label className="cardio-reference-share">Shareable reference link<input readOnly value={shared.url} onFocus={event=>event.target.select()}/></label>}
  </section>;
}
