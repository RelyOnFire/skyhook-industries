import { validateCampaign, type Campaign } from './model.js';

export const DB_NAME = 'skyhook-campaigns';
export interface SaveRecord { id: string; state: Campaign; savedAt: string; checkpoints: Campaign[] }
export interface SaveSummary { id: string; name: string; day: number; savedAt: string; revision: number; valid: boolean; recoverable: boolean }
const MAX_SLOTS = 12;
let connection: Promise<IDBDatabase> | undefined;
function database(): Promise<IDBDatabase> {
  if (!connection) connection = new Promise((resolve,reject) => {
    const request = indexedDB.open(DB_NAME,1);
    request.onupgradeneeded = () => { request.result.createObjectStore('worlds',{ keyPath:'id' }); };
    request.onerror = () => { connection = undefined; reject(Error('Browser saves are unavailable. You can keep playing and download a backup.')); };
    request.onblocked = () => { connection = undefined; reject(Error('Close older campaign tabs, then retry saving.')); };
    request.onsuccess = () => { const db=request.result; db.onversionchange=()=>{db.close();connection=undefined;}; resolve(db); };
  });
  return connection;
}
export async function listSaves(): Promise<SaveSummary[]> {
  const db = await database();
  return new Promise((resolve,reject) => {
    const tx=db.transaction('worlds','readonly'), request=tx.objectStore('worlds').getAll();
    request.onerror=()=>reject(Error('Could not read saved campaigns.'));
    request.onsuccess=()=>resolve(request.result.map((record:SaveRecord) => {
      let state: Campaign | undefined;
      try { state=validateCampaign(record.state); } catch { /* Keep incompatible slots visible and untouched. */ }
      const recoverable=Array.isArray(record.checkpoints) && record.checkpoints.some(c=>{try{validateCampaign(c);return true;}catch{return false;}});
      return { id:record.id, name:state?.name || 'Unreadable or newer save', day:state?.day || 0, revision:state?.revision || 0,
        savedAt:typeof record.savedAt==='string'?record.savedAt:'', valid:!!state, recoverable };
    }).sort((a:SaveSummary,b:SaveSummary)=>b.savedAt.localeCompare(a.savedAt)));
  });
}
export async function loadSave(id: string, checkpoint=false): Promise<Campaign> {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const request=db.transaction('worlds','readonly').objectStore('worlds').get(id);
    request.onerror=()=>reject(Error('Could not load this campaign.'));
    request.onsuccess=()=>{
      const record=request.result as SaveRecord | undefined;
      if(!record){reject(Error('This campaign could not be found.'));return;}
      try {
        if(!checkpoint){resolve(validateCampaign(record.state));return;}
        for(const c of record.checkpoints || []){try{resolve(validateCampaign(c));return;}catch{/* Try the next intact checkpoint. */}}
        reject(Error('No compatible recovery checkpoint is available.'));
      } catch(e){reject(e);}
    };
  });
}
/** Head and recovery copies are committed in one IndexedDB transaction.
 * Compare-and-swap prevents an older tab overwriting newer progress. */
export async function saveCampaign(input: Campaign, expectedRevision: number | null): Promise<number> {
  const state=validateCampaign(input), db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('worlds','readwrite'), store=tx.objectStore('worlds');
    let error='Could not save in this browser. Download a backup or retry.';
    tx.oncomplete=()=>resolve(state.revision); tx.onerror=()=>reject(Error(error)); tx.onabort=()=>reject(Error(error));
    const request=store.get(state.id);
    request.onsuccess=()=>{
      const previous=request.result as SaveRecord | undefined;
      if ((expectedRevision===null && previous) || (expectedRevision!==null && (!previous || previous.state.revision!==expectedRevision))) {
        error='Another tab changed this campaign. Download your current world or load the latest saved version before continuing.'; tx.abort(); return;
      }
      // An older cached app also checks revisions. A schema-only save must
      // invalidate its writer token even when no gameplay action occurred.
      if(previous && previous.state.schema!==state.schema && previous.state.revision===state.revision)state.revision++;
      // Repeated manual saves of an unchanged world must not push meaningful
      // recovery points out of the three-checkpoint history.
      if(previous && JSON.stringify(previous.state)===JSON.stringify(state)) return;
      const write=()=>{
        try {
          const checkpoints=previous ? [previous.state,...(previous.checkpoints||[])].slice(0,3) : [];
          store.put({id:state.id,state,savedAt:new Date().toISOString(),checkpoints} satisfies SaveRecord);
        } catch { tx.abort(); }
      };
      if(previous) write();
      else { const count=store.count(); count.onsuccess=()=>{if(count.result>=MAX_SLOTS){error='All 12 save slots are occupied. Download a backup and delete an unused slot.';tx.abort();}else write();}; }
    };
  });
}
export async function deleteSave(id: string): Promise<void> {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('worlds','readwrite'); tx.objectStore('worlds').delete(id);
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(Error('Could not delete that save.'));
  });
}
