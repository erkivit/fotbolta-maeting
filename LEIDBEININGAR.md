# Mæting — uppsetningarleiðbeiningar

Þessi mappa er tilbúin vefsíða. Gögnin (leikmenn, mæting, tölfræði) eru vistuð
í Supabase-verkefninu þínu ("BFG") í töflunni `app_data`, sem er þegar búin til.

## 1. Settu kóðann á GitHub

1. Farðu á github.com og stofnaðu (ef þú átt ekki) ókeypis aðgang.
2. Búðu til nýtt "repository" (t.d. `fotbolta-maeting`) — hafðu það Public eða Private, hvort er í lagi.
3. Á repository-síðunni, smelltu á "uploading an existing file" og dragðu allar skrárnar úr þessari
   möppu inn (halda skipulaginu: `src/` mappan þarf að fylgja með eins og hún er).
4. Staðfestu upphleðslu ("Commit changes").

## 2. Tengdu við Vercel

1. Farðu á vercel.com, skráðu þig inn (best að nota "Continue with GitHub").
2. Smelltu á "Add New… → Project".
3. Veldu repository-ið sem þú bjóst til (`fotbolta-maeting`).
4. Vercel greinir sjálfkrafa að þetta er Vite verkefni — engar sérstakar stillingar þarf.
5. Smelltu á "Deploy". Eftir ~1 mínútu færð þú vefslóð eins og `fotbolta-maeting.vercel.app`.

## 3. Tengdu þitt eigið lén

1. Í Vercel, farðu í verkefnið → "Settings" → "Domains".
2. Skrifaðu inn lénið þitt (t.d. `maeting.mittdomain.is`) og smelltu "Add".
3. Vercel sýnir þér DNS-færslur sem þú þarft að setja inn hjá þínum lénasala
   (þar sem þú keyptir lénið) — venjulega einn `CNAME` eða `A`-record.
4. Eftir að DNS uppfærist (getur tekið nokkrar mínútur upp í nokkrar klukkustundir)
   er síðan komin á þitt eigið lén.

## Öryggisatriði — vert að vita

Til að appið gæti skrifað gögn án innskráningar hvers leikmanns, er
gagnagrunnstaflan (`app_data`) stillt þannig að **hver sem hefur vefslóðina
getur lesið og breytt öllum gögnum** (leikmenn, mæting, tölfræði, stillingar,
og PIN-númer þjálfara). Þetta er í lagi fyrir lítinn, traustan vinahóp, en
ekki nota þessa uppsetningu fyrir neitt viðkvæmara.

## Ef þú vilt uppfæra síðuna síðar

Sendu mér breytinguna sem þú vilt gera, ég breyti `src/App.jsx`, og þú hleður
nýju skránni upp á GitHub (hún yfirskrifar þá gömlu) — Vercel uppfærir sig
sjálfkrafa á nokkrum sekúndum.
