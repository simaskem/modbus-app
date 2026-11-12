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


## Registrų susiejimo eiga
- Master-Detail išdėstymas ir paieška: Ekranas padalintas į dvi dalis – kairėje valdomi kanalai (su ALL / TCP / RTU filtru) ir įrenginiai, o dešinėje – pasirinkto įrenginio (arba visų įrenginių vienu metu) registrų lentelė su greita paieška.
- Įrenginių perkėlimas tarp kanalų: Pažymėtus įrenginius galima vienu veiksmu perkelti į kitą kanalą kartu su visais jiems priskirtais registrais.
- Masiniai veiksmai (Bulk Actions): Didelis dėmesys rankinio darbo mažinimui – galima vienu metu pakeisti pažymėtų registrų parametrus (acq_cycle, func_code, byte_order), juos ištrinti arba nukopijuoti į naujai sukurtą įrenginį (su automatiniu nuoseklių ID pergeneravimu).
- Importas ir eksportas: Palaikomas pilnos konfigūracijos eksportavimas ir validuotas importavimas JSON formatu.

## Pramoninis patogumas
- Kategorizuotas monitoringas: Duomenys suskirstyti į 6 inžinerines kategorijas (Volts, Amps, kW, kVA, kVAr, Energy). Neaktyvūs kanalai išfiltruojami, o kategorijos be aktyvių registrų automatiškai išjungiamos su paaiškinančiu tooltip.
- Multi-registrų palyginimas ir skalių apsauga: Viename grafike leidžiama lyginti iki 6 registrų iš skirtingų įrenginių, o ilgi pavadinimai automatiškai sutrumpinami. Griežtas filtravimas neleidžia ant bendros Y ašies maišyti skirtingų matavimo vienetų ar skalių (pvz., Volts ir Amps arba kW ir kVAr).
- Momentiniai pradiniai duomenys: Pradinės reikšmės atsiunčiamos akimirksniu, o ilgiems nuskaitymo ciklams (pvz., Energy su 1 valandos ciklu) taikomas pagreitintas simuliacijos intervalas kas 10 sek., kad inžinieriui nereikėtų laukti valandos.

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

