export default function parseUserId(arg: string | null | undefined): string | null {
  if (!arg?.trim()) return null;
  
  const trimmed = arg.trim();
  
  const mentionMatch = trimmed.match(/^<@!?(\d{17,19})>$/);
  if (mentionMatch) return mentionMatch[1];
  
  if (/^\d{17,19}$/.test(trimmed)) return trimmed;
  
  return null;
}

/*

   ("`-''-/").___..--''"`-._ 
   `6_ 6  )   `-.  (     ).`-.__.`) 
   (_Y_.)'  ._   )  `._ `. ``-..-`  
  _..`--'_..-_/  /--'_.' ,'  
(il),-''  (li),'  ((!.-'

*/
