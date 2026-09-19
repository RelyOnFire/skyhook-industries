import { useEffect, useState } from 'react';

export default function NumericField({name,label,unit,value,min,max,step,onChange,onValidity}:{name:string;label:string;unit:string;value:number;min:number;max:number;step:number;onChange:(n:number)=>void;onValidity:(invalid:boolean)=>void}){
  const [text,setText]=useState(String(value)),[invalid,setInvalid]=useState(false);
  useEffect(()=>setText(String(value)),[value]);
  return <div className="phobos-field"><label htmlFor={`p-${name}`}>{label}<span>{unit}</span></label><div>
    <input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={e=>{setText(e.target.value);setInvalid(false);onValidity(false);onChange(+e.target.value);}}/>
    <input id={`p-${name}`} aria-label={`${label} value`} type="number" min={min} max={max} step="any" value={text} aria-invalid={invalid||undefined} aria-describedby={invalid?`p-${name}-error`:undefined} onChange={e=>{
      setText(e.target.value);const n=e.target.valueAsNumber,bad=!Number.isFinite(n)||n<min||n>max;setInvalid(bad);onValidity(bad);if(!bad)onChange(n);
    }}/></div>{invalid&&<small id={`p-${name}-error`} className="field-error">Enter {min}–{max} {unit}.</small>}</div>;
}
