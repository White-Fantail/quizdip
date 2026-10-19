import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("Kids is a real native Expo app, not a webview shell",()=>{
 const pkg=JSON.parse(source("package.json")),cfg=JSON.parse(source("app.json"));
 assert.equal(pkg.main,"expo-router/entry");
 assert.match(pkg.dependencies.expo,/^~57\./);
 assert.deepEqual(cfg.expo.platforms,["ios","android","web"]);
 assert.equal(cfg.expo.web.bundler,"metro");
 assert.equal(pkg.dependencies["react-dom"],pkg.dependencies.react);
 assert.match(pkg.dependencies["react-native-web"],/^\^0\.21\./);
 assert.match(pkg.dependencies["@expo/metro-runtime"],/^~57\./);
 assert.equal(cfg.expo.ios.supportsTablet,true);
 assert.ok(cfg.expo.android.package);
 for(const page of ["index","explore","challenge","treasures"]) assert.match(source("app/(tabs)/"+page+".tsx"),/Screen/);
 assert.doesNotMatch(source("app/(tabs)/index.tsx"),/WebView/);
});
test("native discovery is read-only, locale-scoped and server-safe",()=>{
 const src=source("app/(tabs)/explore.tsx"),api=source("src/services/api.ts");
 const discovery=source("src/useKidsAdventures.ts");
 assert.match(discovery,/kidsApi\.catalog\(token/);
 assert.match(discovery,/kidsApi\.packs\(token/);
 assert.match(discovery,/kidsApi\.features\(token/);
 assert.match(discovery,/time\.status!=="allowed"/);
 assert.match(source("../../packages/api-client/src/index.ts"),/kidsEligible===true/);
 assert.doesNotMatch(src,/play_guess|play_start|answer\.canonical/);
 assert.match(api,/export const KIDS_API_ORIGIN = "https:\/\/quizdip\.com"/);
 assert.doesNotMatch(api,/process\.env|EXPO_PUBLIC_QUIZDIP_API_URL/);
 for(const client of ["QuizDipPublicApi","QuizDipKidsDeviceApi","QuizDipKidsParentApi"])
  assert.ok(api.includes("new "+client+"(KIDS_API_ORIGIN)"));
 assert.doesNotMatch(api,/DATABASE_URL|BETTER_AUTH_SECRET/);
});
test("Phase 2 only opens child routes with a validated native credential",()=>{
 const home=source("app/(tabs)/index.tsx");
 const gate=source("app/(tabs)/_layout.tsx");
 const setup=source("app/setup.tsx");
 assert.match(home,/go\("\/parent"\)/);
 assert.match(home,/native\.home\.hello/);
 assert.match(gate,/status!=="active"/);
 assert.match(setup,/session\.claimPair\(/);
 assert.match(setup,/QRCode/);
 assert.match(setup,/request\.shortCode/);
});

test("browser-only preview never imports child credentials or live backend",()=>{
 const preview=source("src/web/Preview.tsx");
 assert.match(source("app/_layout.web.tsx"),/Slot/);
 assert.match(source("app/(tabs)/_layout.web.tsx"),/Slot/);
 assert.match(preview,/BROWSER PREVIEW|브라우저 미리보기/);
 assert.doesNotMatch(preview,/SecureStore|localStorage|sessionStorage|fetch\(|kidsApi|parentApi|EXPO_PUBLIC_|Authorization/);
 assert.match(source("app/_layout.tsx"),/KidsSessionProvider/);
 for(const page of ["setup","game","parent","guardian","time-up"])
   assert.match(source("app/"+page+".web.tsx"),/Preview/);
});

test("Kids home uses a personal greeting and compact PIN-guarded parents entry",()=>{
 const home=source("app/(tabs)/index.tsx");
 const screen=source("src/components/Screen.tsx");
 const gate=source("app/parent.tsx");
 const locales=source("../../packages/i18n/src/kids.ts");
 assert.match(home,/session\.profile\.nickname\.trim\(\)/);
 assert.match(home,/headerAction=\{<KidsTap/);
 assert.match(home,/go\("\/parent"\)/);
 assert.doesNotMatch(home,/styles\.locale|native\.session\.pinned/);
 assert.match(screen,/headerAction\?:ReactNode/);
 assert.match(gate,/parent\.authorize\(pin\)/);
 assert.match(locales,/"native\.home\.hello": "Hello"/);
 assert.match(locales,/"native\.home\.hello": "안녕"/);
});


test("native Kids decorative icons are font-independent SVGs",()=>{
 const icon=source("src/components/KidsIcon.tsx");
 assert.match(icon,/from "react-native-svg"/);
 for(const emoji of ["🏠","🧭","📚","🧩","⭐","✨","🦕","🦁","🌍","🚀","🔒","👨‍👩‍👧"])
   assert.ok(icon.includes(`"${emoji}"`),`missing vector icon mapping for ${emoji}`);
 assert.match(source("app/(tabs)/_layout.tsx"),/tabBarIcon:\(\{color\}\)=> <KidsEmojiIcon/);
 assert.doesNotMatch(source("app/(tabs)/_layout.tsx"),/fontSize:23/);
 for(const path of ["src/components/Screen.tsx","src/components/AdventureTile.tsx"])
   assert.match(source(path),/<KidsEmojiIcon/);
 for(const path of ["app/(tabs)/explore.tsx","app/(tabs)/packs.tsx","app/(tabs)/challenge.tsx",
   "app/(tabs)/treasures.tsx","app/game.tsx","app/guardian.tsx","app/time-up.tsx"])
   assert.match(source(path),/KidsEmojiIcon/);
});


test("Play opens dedicated worlds and all-packs screens without leaving surprise mode in category",()=>{
 const home=source("app/(tabs)/index.tsx");
 const worlds=source("app/(tabs)/worlds.tsx");
 const world=source("app/(tabs)/world.tsx");
 const all=source("app/(tabs)/all-packs.tsx");
 const tabs=source("app/(tabs)/_layout.tsx");
 const counter=source("src/adventures.ts");
 const browser=source("src/useKidsPackBrowse.ts");
 assert.match(home,/useKidsPackBrowse/);
 assert.match(home,/go\("\/worlds"\)/);
 assert.match(home,/pathname:"\/world"/);
 assert.match(home,/go\("\/all-packs"\)/);
 assert.match(home,/mode:"RANDOM_FIVE"/);
 assert.doesNotMatch(home,/setSelected|shownQuizzes/);
 assert.match(worlds,/pathname:"\/world"/);
 assert.match(worlds,/BrowseBack/);
 assert.match(world,/BrowseBack/);
 assert.match(world,/router\.replace\(from==="worlds"\?"\/worlds":"\/"\)/);
 assert.doesNotMatch(world,/RANDOM_FIVE|Surprise me|worldsToShow/);
 assert.match(world,/packs\.filter\(pack=>adventureForPack\(pack\)===item\.id\)/);
 assert.match(all,/packs\.map/);
 assert.match(all,/item\.inKidsPack===false/);
 assert.match(counter,/Count a pack once/);
 assert.doesNotMatch(counter,/\.length\+\s*quizzes/);
 assert.ok(browser.includes("while(live&&nextOffset!==null)"));
 assert.match(browser,/PAGE_SIZE=20/);
 for(const route of ["explore","challenge","worlds","world","all-packs"])
   assert.ok(tabs.includes('name="'+route+'" options={{href:null}}'));
 for(const label of ["kids.nav.play","kids.nav.stars"])assert.ok(tabs.includes(label));
});
test("Challenge missions reuse child-approved packs, saved progress, and native game routes",()=>{
 const challenge=source("app/(tabs)/challenge.tsx");
 const game=source("app/game.tsx");
 const locale=source("../../packages/i18n/src/kids.ts");
 assert.match(challenge,/useKidsAdventures/);
 assert.match(challenge,/packs\.slice\(0,4\)/);
 assert.match(challenge,/mode:"RANDOM_FIVE"/);
 assert.match(challenge,/packId:pack\.id/);
 assert.match(challenge,/SecureStore\.getItemAsync\(SAVED_GAME\)/);
 assert.match(challenge,/canResume\?<KidsTap/);
 assert.match(game,/quizdip-kids-active-game-v1/);
 assert.match(challenge,/AdventureArtwork/);
 for(const key of ["native.challenge.start","native.challenge.packHeading","native.challenge.resumeDetail"])
   assert.ok(locale.includes('"'+key+'"'));
 assert.doesNotMatch(challenge,/publicApi|leaderboard|reviewUpsert/);
});

test("My Stars uses child-owned scores and offers repeat play",()=>{
 const stars=source("app/(tabs)/treasures.tsx");
 const server=source("../web/src/modules/kids/game.ts");
 const game=source("app/game.tsx");
 assert.match(stars,/kidsApi\.treasures\(token\)/);
 assert.match(stars,/recentPacks\.map/);
 assert.match(stars,/pack\.bestScore/);
 assert.match(stars,/params:\{packId:pack\.packId\}/);
 assert.match(stars,/badgeSlots\.map/);
 assert.match(stars,/data\.discoveries/);
 assert.match(game,/native\.stars\.playAgain/);
 assert.match(server,/bestByPack/);
 assert.match(server,/kidOwnership:\{is:\{profileId\}\}/);
 assert.doesNotMatch(stars,/publicApi|leaderboard|AsyncStorage/);
});
