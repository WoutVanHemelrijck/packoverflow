import { cosine, embed, MODEL_ID } from "../src/lib/embed";

const texts = {
  nl: "De maximale werkgeversbijdrage voor maaltijdcheques bedraagt 8,91 euro per cheque.",
  fr: "La contribution patronale maximale pour les chèques-repas s'élève à 8,91 euros par chèque.",
  sick: "Bij ziekte moet de werknemer zijn werkgever onmiddellijk verwittigen en een medisch attest bezorgen.",
};

async function main() {
  const t0 = Date.now();
  const [nl, fr, sick] = await embed(Object.values(texts));
  console.log(`${MODEL_ID} dims=${nl.length} in ${Date.now() - t0}ms`);
  const nlFr = cosine(nl, fr);
  const nlSick = cosine(nl, sick);
  const frSick = cosine(fr, sick);
  console.log({ nlFr: nlFr.toFixed(3), nlSick: nlSick.toFixed(3), frSick: frSick.toFixed(3) });
  if (!(nlFr > nlSick && nlFr > frSick)) {
    console.error("FAIL: cross-lingual meal voucher pair is not the closest");
    process.exit(1);
  }
  console.log("PASS");
}

main();
