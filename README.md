# Modbus App

Full-stack Node.js ir React aplikacija, skirta Linux įrenginiams.

## Greitas paleidimas

```bash
npm install && npm run build && npm start
```

Aplikacija veiks adresu `http://localhost:8000` (portą galima pakeisti per `PORT` kintamąjį).

## Pagrindinės komandos

* `npm run dev` – paleidžia kūrimo režimu (frontend: `http://localhost:3000`).
* `npm run build` – sukompiliuoja projektą produkcijai.
* `npm start` – paleidžia produkcijos serverį (`http://localhost:8000`).

## Diegimas įrenginyje

Norint įdiegti tik veikimui būtinus paketus (be kūrimo įrankių):

```bash
npm ci --omit=dev
npm start
```

## Architektūra ir pasirinktos technologijos

Aplikacija sukurta taip, kad sklandžiai veiktų embedded Linux įrenginiuose su ribotais CPU ir RAM resursais. Kiekviena biblioteka pasirinkta siekiant išlaikyti kuo mažesnį atminties naudojimą ir galutinio paketo dydį.

### Svarbiausi architektūriniai sprendimai
- Vieno proceso gamybinis režimas: Gamybiniame režime `express` tiesiogiai atiduoda sukompiliuotus statinius React failus iš `client/dist` per `8000` portą, todėl įrenginyje sukasi tik vienas `node` procesas.
- Standartinis monorepo: Naudojami įmontuoti `npm workspaces` (`client` ir `server`) be jokių sunkių išorinių įrankių, tokių kaip `Turborepo` ar `Nx`.
- Be duomenų bazės: Konfigūracija nuskaitoma ir išsaugoma tiesiogiai į `server/modbus_config.json` failą per integruotą Node.js `fs/promises` API.
- Be `dotenv` ir sunkių UI bibliotekų: Aplinkos kintamieji (`PORT`, `NODE_ENV`) perduodami paleidimo skriptuose, o vartotojo sąsajai naudojami standartiniai React kabliukai bei švarus CSS vietoj `Redux` ar `Material UI`, todėl galutinis kliento paketas sveria tik apie `276 KB`.

### Backend (`Node.js`, `Express`, `TypeScript`)
- `express`: Aptarnauja REST API maršrutus ir atiduoda sukompiliuotą kliento aplikaciją gamybiniame režime.
- `ws`: Naudojamas realaus laiko Modbus duomenų srautui vietoj `Socket.io`, nes nenaudoja perteklinių tinklo duomenų ir nereikalauja papildomos kliento bibliotekos.
- `pino`: Pasirinktas registravimui (logams) vietoj `Winston`, nes asinchroniškai rašo JSON logus minimaliai apkraudamas CPU ir nestabdo pagrindinės programos gijos.
- `./server/dist – 40 KB.`

### Frontend (`React`, `TypeScript`, `Vite`)
- `vite`: Sukompiliuoja kliento kodą į itin lengvą paketą (`~45 KB` su gzip), kuris greitai užsikrauna vietiniame tinkle.
- `uplot`: Naudojamas realaus laiko grafikams vietoj `Chart.js` ar `Recharts`. Jis piešia ant HTML5 Canvas, o ne sunkių SVG elementų, todėl sklandžiai atnaujina dažnai kintančius duomenis `60 FPS` dažniu.
- `@tanstack/react-virtual`: Virtualizuoja dideles duomenų taškų lenteles, kad naršyklėje būtų atvaizduojamos tik tuo metu ekrane matomos eilutės.
- `./client/dist ~276 KB (su gzip apie 85–90 KB)`


## Registrų susiejimo eiga (Register Mapping Workflow)

- Duomenų nuskaitymas ir suplokštinimas (Normalization): Serveris vieną kartą nuskaito medžio struktūros `modbus_config.json` į RAM podėlį ir atiduoda per `GET /api/config`. Kliento pusėje medžio struktūra (`Kanalas -> Stotis -> Registrai`) iškart transformuojama į plokščią būseną (Normalized State), susiejant kiekvieną registrą su stotimi per unikalius vidinius ID. Tai leidžia akimirksniu (`O(1)`) surasti, filtruoti ir atnaujinti registrus.
- Master-Detail išdėstymas ir virtualizacija: Ekranas padalintas į dvi zonas – kairėje valdomi kanalai (su `ALL` / `TCP` / `RTU` filtru) ir įrenginiai, o dešinėje rodoma pasirinkto įrenginio (arba visų įrenginių vienu metu) registrų lentelė. Dideliems registrų kiekiams atvaizduoti naudojama DOM virtualizacija (`@tanstack/react-virtual`) ir `React.memo`, todėl naršyklėje renderinamos tik tuo metu ekrane matomos eilutės (`~20`).
- Registrų valdymo būdai:
  - Individualus kūrimas: Galima pridėti naują registrą pasirinktai stočiai (su automatiniu `reg_size` parinkimu pagal duomenų tipą ir nuosekliu ID suteikimu).
  - Greita paieška ir filtravimas: Akimirksniu filtruojama pagal registro aprašymą, pradinį adresą (`start_addr`) arba funkcijos kodą (`func_code`).
  - Masiniai veiksmai (Bulk Actions): Pažymėjus kelis registrus, galima vienu paspaudimu pakeisti jų parametrus (`acq_cycle`, `func_code`, `byte_order`), juos masiškai ištrinti arba nukopijuoti į naujai sukurtą įrenginį.
  - Įrenginių perkėlimas tarp kanalų: Perkeliant stotis į kitą kanalą, visi joms priskirti registrai keliauja kartu automatiškai, keičiant tik stoties nuorodą į kanalą.
  - Importas ir eksportas: Palaikomas pilnos konfigūracijos eksportavimas ir validuotas importavimas JSON formatu.
- Validacija ir atominis įrašymas atgal: Kiekvienas registrų pakeitimas tikrinamas pagal Modbus taisykles (adresų persidengimas tame pačiame funkcijos kode, `0–65535` ribos, `scale != 0`). Prieš išsaugant, plokščia būsena vėl sulipdoma į pradinį medžio JSON formatą (Denormalization) ir serveryje atomiškai įrašoma į diską per `.tmp` failą bei `fs.rename`.
- Realaus laiko registrų stebėjimas (Monitoring): Pasirinkus registrus Monitoring skiltyje, naudojama lengva `ws` (WebSocket) biblioteka su prenumeratos modeliu (On-Demand). Serveris viename `250 ms` cikle tikrina tik prenumeruotus registrus pagal jų `acq_cycle` ir siunčia pakeitimus paketais (Batching), o klientas juos atvaizduoja HTML5 Canvas grafike (`uPlot`) su laiko langu ribotu duomenų buferiu (Ring Buffer).


## Pramoninis patogumas (Industrial Usability)

- Centralizuotas valdymas vietoj rankinio failų redagavimo: Inžinieriui nebereikia jungtis prie įrenginio per SSH ir ranka taisyti sudėtingo JSON failo – vienoje sąsajoje jis gali valdyti visus TCP ir RTU ryšio kanalus, keisti jų parametrus (IP, prievadus, `baudrate`), kurti ar šalinti įrenginius bei jų registrus.
- Apsauga nuo gamybinių klaidų (Fail-Safe Validation): Dirbant su daugeliu įrenginių lengva suklysti, todėl sistema aktyviai blokuoja kritines Modbus klaidas – registrų adresų persidengimus, dubliuotus RTU stoties (Slave) adresus (`1–247`), dalybą iš nulio (`scale != 0`) bei neatitinkančius `reg_size` dydžius tiek naršyklėje, tiek serveryje.
- Greitas diegimas ir masiniai veiksmai: Prijungus naują tokio paties tipo skaitiklį ar daviklį, inžinieriui nereikia iš naujo suvedinėti dešimčių registrų – juos galima vienu paspaudimu nukopijuoti iš esamo įrenginio (su automatiniu ID pergeneravimu), masiškai keisti jų nuskaitymo ciklus ar perkelti visus įrenginius tarp kanalų.
- Kategorizuotas monitoringas ir triukšmo mažinimas: Duomenys suskirstyti į 6 inžinerines kategorijas (`Volts`, `Amps`, `kW`, `kVA`, `kVAr`, `Energy`). Neaktyvūs kanalai (`enable: false`) automatiškai išfiltruojami, o kategorijos be aktyvių registrų išjungiamos su paaiškinančiu `tooltip`, kad inžinierius matytų tik realiai veikiančią įrangą.
- Skirtingų įrenginių palyginimas viename grafike: Viename grafike leidžiama lyginti iki 6 registrų iš skirtingų įrenginių (pvz., patikrinti fazių apkrovas ar įtampos kritimus tarp kelių skaitiklių), o ilgi pavadinimai automatiškai sutrumpinami. Griežtas filtravimas neleidžia ant bendros Y ašies maišyti skirtingų matavimo vienetų ar skalių (pvz., `Volts` ir `Amps` arba `kW` ir `kVAr`).
- Momentinė diagnostika vietoje: Pradinės reikšmės atsiunčiamos akimirksniu, o ilgiems nuskaitymo ciklams (pvz., `Energy` su 1 valandos ciklu) taikomas pagreitintas simuliacijos intervalas kas `10 sek.`, kad inžinierius objekte galėtų iškart įsitikinti, jog ryšys su įrenginiu veikia, nelaukdamas valandos.


## Resursų taupymas įrenginyje (Embedded Constraints)

### 1. RAM (operatyviosios atminties) taupymas
- Vieno proceso architektūra: Produkcijoje `express` tiesiogiai atiduoda sukompiliuotus failus iš `client/dist`, todėl įrenginyje sukasi tik vienas `node` procesas (be papildomo `Nginx` ar atskiro frontend serverio).
- Ribotas laiko lango buferis (Ring Buffer): Kliento pusėje istoriniai duomenys griežtai apkarpomi pagal pasirinktą langą (`1`, `3`, `5` arba `10` min.), o uždarius stebėjimo langą ar atžymėjus registrą – išvalomi iš atminties.
- Minimalus priklausomybių pėdsakas: Vietoj sunkių UI ar schemų bibliotekų (`MUI`, `Recharts`, `Zod`) naudojamas švarus CSS, lengvas `uPlot` (`~35 KB`) ir `@tanstack/react-virtual` (`~3 KB`).
- Be išorinės duomenų bazės: Konfigūracija laikoma JSON faile ir serverio RAM podėlyje.

### 2. CPU (procesoriaus) taupymas
- On-Demand WebSocket ir simuliacija: WebSocket ryšys ir serverio simuliacijos ciklas veikia tik tada, kai vartotojas stebi bent vieną registrą. Kai niekas nestebi, CPU apkrova yra `0 %`.
- Bendras ciklas ir duomenų grupavimas (Batching): Užuot kūrus atskirus laikmačius kiekvienam registrui, serveryje sukasi vienas bendras `250 ms` ciklas, kuris siunčia tik tuo metu atsinaujinusių ir prenumeruotų registrų paketą.
- DOM virtualizacija ir `React.memo`: Sąrašuose `@tanstack/react-virtual` atvaizduoja tik ekrane matomas eilutes (`~20`), o plokščia būsena (`O(1)` paieška) su `React.memo` neleidžia perpiešti visos sąsajos atsinaujinus vienam registrui.
- HTML5 Canvas grafikai: `uPlot` piešia ant `<canvas>` ir atnaujina reikšmes per `setData` neperkurdamas grafiko objekto.

### 3. Flash atminties (disko vietos ir rašymo ciklų) taupymas
- Serverio atminties podėlis (RAM Cache): Konfigūracijos failas iš disko nuskaitomas tik vieną kartą starto metu, o visos `GET` užklausos aptarnaujamos iš RAM, taip tausojant Flash atminties skaitymo operacijas.
- Atominis failų įrašymas: Išsaugant pakeitimus, duomenys pirmiausia įrašomi į laikiną `.tmp` failą ir tik tada atomiškai pervadinami (`fs.rename`), apsaugant konfigūraciją nuo sugadinimo dingus elektrai.
- Atskirtos kūrimo priklausomybės (`devDependencies`): Kompiliavimo įrankiai (`TypeScript`, `Vite`) atskirti į `devDependencies`, todėl įrenginyje su `npm ci --omit=dev` įrašomi tik būtini vykdymo (`runtime`) paketai.
- Atidėtas ir atominis įrašymas į Flash (Debounced Atomic Write): Serveris nuolat laiko konfigūraciją RAM podėlyje, o fizinį įrašymą į diską atideda 2 sekundėms (Debounce) ir atlieka per .tmp failą bei fs.rename (su priverstiniu išsaugojimu stabdant serverį). Tai sumažina Flash atminties rašymo ciklus ir apsaugo failą nuo sugadinimo dingus maitinimui.


