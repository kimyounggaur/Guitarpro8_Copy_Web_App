import { emptyGuitar, chordsAndRests } from "./index";
import { createBeat, createNote, createTrack } from "../../model/factory";
import { createDemoScore } from "../../model/demoScore";

export const notationVisualNames = ["demo", "ledger-lines", "g-sharp-natural", "bass-clef", "mid-system-3-4", "piano-grand", "tab-only", "drums-kick-bend"] as const;

export function notationVisualScore(name: typeof notationVisualNames[number]) {
const score = name === 'demo' ? createDemoScore() : name === 'drums-kick-bend' ? chordsAndRests() : emptyGuitar(name === 'mid-system-3-4' ? 3 : 1);
const figure = (notes: ReturnType<typeof createNote>[]) => notes.map((note)=>createBeat({rest:false,notes:[note]}));
const guitar = score.tracks[0];
if (name === 'ledger-lines') {
  guitar.bars[0].voices[0].beats=figure([createNote(6,0),createNote(1,0),createNote(2,0),createNote(1,12)]);
} else if (name === 'g-sharp-natural') {
  score.masterBars[0].keySignature={key:'G',mode:'major'};
  guitar.bars[0].voices[0].beats=figure([createNote(1,2),createNote(1,1),createNote(1,1),createNote(1,2)]);
} else if (name === 'bass-clef') {
  guitar.tuning.strings=[28,33,38,43]; guitar.clef='bass8vb'; guitar.name='Bass'; guitar.shortName='Bs.';
  guitar.bars[0].voices[0].beats=figure([createNote(4,0),createNote(3,0),createNote(2,0),createNote(1,0)]);
} else if (name === 'mid-system-3-4') {
  score.masterBars[2].timeSignature={numerator:3,denominator:4,beamingPreset:'default'};
  guitar.bars.forEach((bar,i)=>bar.voices[0].beats=figure([0,2,4,5].slice(0,i===2?3:4).map(f=>createNote(1,f))));
} else if (name === 'piano-grand') {
  const piano=createTrack({name:'Piano',shortName:'Pno.',color:'#64748b',icon:'piano',strings:[48,52,55,60,64],tuningLabel:'Keyboard',notationTypes:['standard'],staffConfig:'grand',stringed:false,kind:'pitched',clef:'grand'});
  piano.bars[0].voices[0].beats=figure([36,48,60,72].map(midiPitch=>({...createNote(0,-1),midiPitch})));
  score.tracks=[piano];
} else if (name === 'tab-only') {
  guitar.notationTypes=['tab']; guitar.bars[0].voices[0].beats=figure([0,2,4,5].map(f=>createNote(3,f)));
} else if (name === 'drums-kick-bend') {
  const drums=createTrack({name:'Drum Kit',shortName:'Dr.',color:'#dc2626',icon:'drums',strings:[36,38,42],tuningLabel:'GM Kit',notationTypes:['standard'],stringed:false,kind:'percussion',clef:'percussion'},2);
  drums.bars[0].voices[0].beats=figure([36,38,42,46].map(midiNumber=>({...createNote(0,-1),midiNumber,articulation:'normal'})));
  guitar.bars[1].voices[0].beats[0].notes[0].bend={points:[{offset:0,value:0},{offset:60,value:1}]};
  score.tracks.push(drums);
}
score.meta.title = name === 'demo' ? 'TabScore demo' : name;
return score;
}
