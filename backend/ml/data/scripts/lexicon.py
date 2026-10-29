"""Phrase banks for Hindi-in-Roman (Hinglish) and English text generation. NO Devanagari anywhere.

Gender markup:  {m|f}  -> first form for male speaker, second for female speaker.
Named slots:     {name}  filled by fmt().
All lines are hand-written; variety comes from composition, not from an LLM.
"""
from __future__ import annotations
import re

_G = re.compile(r"\{([^{}|]*)\|([^{}|]*)\}")


def fmt(text: str, gender: str = "M", coord: bool = False, **kw) -> str:
    """Fill {slots} and resolve {male|female} gender markup."""
    for k, v in kw.items():
        text = text.replace("{" + k + "}", str(v))
    return _G.sub(lambda m: m.group(1) if gender == "M" else m.group(2), text)


CUE_EN = dict(pain="pain", weakness="weakness / low energy", low_appetite="reduced appetite", poor_sleep="poor sleep",
              low_mood="low mood", loneliness="feelings of loneliness", confusion="some confusion", dizziness="dizziness",
              breathlessness="breathlessness", fall="a fall", fever="fever", swelling="swelling in the feet",
              headache="headache", chest_discomfort="chest discomfort", urinary="urinary discomfort",
              medication_issue="difficulty with medicines")
CUE_HI = dict(pain="dard", weakness="kamzori", low_appetite="bhookh kam lagna", poor_sleep="neend ki pareshani", low_mood="udaasi",
              loneliness="akelapan", confusion="thodi uljhan", dizziness="chakkar aana", breathlessness="saans phoolna", fall="gir jaana",
              fever="bukhaar", swelling="pairon mein sujan", headache="sir dard", chest_discomfort="seene mein bechaini",
              urinary="peshaab mein takleef", medication_issue="dawaiyon mein dikkat")

# =============================================================================================
# per-cue bank (all Roman Hindi, slow & simple, respectful 'aap')
#  q: coordinator question | pos_m / pos_s: senior mention mild / strong | neg: denial | hist: historical mention
#  ack_m / ack_s: coordinator acknowledgement | voice: voice-note lines | fam_h / fam_e: family observation, {rel}
# =============================================================================================
CB = {
 "pain": dict(
  q=["Kahin dard toh nahi ho raha aajkal? Ghutnon mein, kamar mein, ya kahin aur? Aaram se bataiye.",
     "Sharir mein kahin koi dard hai kya aaj? Bataiye ji."],
  pos_m=["Haan beta, ghutnon mein thoda dard rehta hai. Chal lete hain, zyada nahi hai.", "Thoda kamar mein khinchav sa hai, bas.",
         "Halka-halka dard hai jodon mein, wahi purana wala."],
  pos_s=["Bahut dard hai beta, ghutna toh jaise jaam ho gaya hai. Seedhiyan chadhna mushkil hai.",
         "Raat bhar kamar mein bahut dard raha, neend bhi nahi aayi.", "Dard badh gaya hai, dawai lene par bhi kam nahi ho raha."],
  neg=["Nahi beta, aaj dard nahi hai, theek hain.", "Dard-vard kuch nahi hai aaj."],
  hist=["Pichle hafte ghutne mein dard tha, ab kuch kam hai."],
  ack_m=["Theek hai ji, main note kar le{ta|ti} hoon. Thoda aaram bhi kar lijiyega."],
  ack_s=["Oh, ye sunkar achha nahi laga. Aap zyada zor mat daliye, aaram kijiye. Main doctor sahab se dikhane ka intezaam poochh{ta|ti} hoon. Dawai apne mann se mat badhaiyega."],
  voice=["Beta, aaj ghutne mein bahut dard hai, zara dekh lena. Chal nahi pa rahe hain.", "Namaste beta, kamar ka dard phir shuru ho gaya hai. Dawai bhi khatam hone wali hai."],
  fam_h=["Kal {rel} se baat hui, bol rahe the ghutne mein bahut dard hai, seedhiyan bhi nahi chadh paa rahe.",
         "{rel} kaafi der se kamar pakad ke baithe the jab maine video call kiya. Dard zyada lag raha hai kya?"],
  fam_e=["Spoke to {rel} yesterday - complains of a lot of knee pain and says climbing stairs is hard.",
         "During our video call {rel} kept holding the lower back. Could you check if the pain has increased?"]),
 "weakness": dict(
  q=["Sharir mein taaqat kaisi lag rahi hai? Thakaan toh nahi rehti?", "Aajkal kamzori ya sustee jaisa toh nahi lagta?"],
  pos_m=["Haan, thodi kamzori si rehti hai, dopahar tak thak jaate hain.", "Aajkal jaldi thak jaata hoon beta."],
  pos_s=["Bahut kamzori lag rahi hai, uthne-baithne mein bhi haath-pair mein jaan nahi lagti.", "Do din se bistar se uthne ka mann hi nahi karta, bilkul taaqat nahi hai."],
  neg=["Nahi, kamzori nahi hai, taaqat theek hai.", "Sab theek hai, thakaan nahi lagti."],
  hist=["Pichle hafte bukhaar ke baad kamzori thi, ab behtar hai."],
  ack_m=["Ji, khoob paani aur samay par khana khaiyega. Main note kar le{ta|ti} hoon."],
  ack_s=["Ye thodi chinta ki baat hai ji. Aap aaram kijiye, main aapke parivaar ko bata de{ta|ti} hoon taaki doctor ko dikhane ka intezaam ho jaaye."],
  voice=["Beta, aaj bahut kamzori lag rahi hai, utha bhi nahi ja raha.", "Thodi tabiyat dheeli hai aaj, bas bata rahe the."],
  fam_h=["{rel} kal call par bahut thake hue lag rahe the, awaaz mein bhi dum nahi tha.", "{rel} ne kaha body mein taaqat nahi lag rahi, subah se bistar mein hain."],
  fam_e=["{rel} sounded very tired on the phone, with very little energy.", "{rel} said they feel weak and stayed in bed most of the day."]),
 "low_appetite": dict(
  q=["Khana-peena kaisa chal raha hai? Bhookh theek lagti hai?", "Aaj kya-kya khaya aapne? Bhookh toh lag rahi hai na?"],
  pos_m=["Bhookh thodi kam lagti hai aajkal, ek roti kam khaate hain.", "Khaane mein mann nahi lagta, bas aadha khana khaya."],
  pos_s=["Do din se khana khaane ki bilkul ichha nahi ho rahi, bas chai pi hai.", "Kuch achha hi nahi lagta khaane mein, kal raat ka khana bhi chhod diya."],
  neg=["Haan, bhookh theek lagti hai, dal-roti khayi aaj.", "Khana theek chal raha hai beta."],
  hist=["Do-teen din bhookh kam thi, ab theek hai."],
  ack_m=["Ji, thoda-thoda karke din mein kai baar kha lijiye, daliya, khichdi, phal. Main note kar le{ta|ti} hoon."],
  ack_s=["Ye baat mere liye zaroori hai ji. Bhookh na lagna kai baar kisi wajah se hota hai, isliye doctor sahab ko dikhana achha rahega. Main parivaar se baat kar{ta|ti} hoon."],
  voice=["Beta, khana achha nahi lag raha aajkal, kuch khaya nahi jaata."],
  fam_h=["{rel} ne bataya khana kam kha rahe hain, kal sirf chai aur biscuit liya.", "Maine dekha {rel} ne thali mein aadha khana chhod diya, pehle aisa nahi karte the."],
  fam_e=["{rel} has been eating very little lately; yesterday only tea and a biscuit.", "I noticed {rel} left half the meal untouched, which is unusual."]),
 "poor_sleep": dict(
  q=["Raat ko neend kaisi aayi? Theek se so paaye?", "Aajkal neend kaisi rehti hai aapki?"],
  pos_m=["Neend thodi toot-toot kar aati hai, teen-chaar baje aankh khul jaati hai.", "Raat ko der tak neend nahi aayi."],
  pos_s=["Kal raat bilkul neend nahi aayi, bechaini rahi, baar-baar uth{ta|ti} raha.", "Poori raat karvatein badalte rahe, subah tak aankh nahi lagi."],
  neg=["Haan, neend achhi aayi, saat-aath ghante soye.", "Neend theek hai beta."],
  hist=["Pichle hafte neend nahi aati thi, ab theek hai."],
  ack_m=["Ji, shaam ko chai-coffee kam kar lijiye aur sone ka samay ek hi rakhiye. Main note kar le{ta|ti} hoon."],
  ack_s=["Kai raat neend na aana theek nahi hai ji. Main aapke parivaar ko bata{oonga|oongi} aur doctor se baat karne ki salaah doon{ga|gi}."],
  voice=["Beta raat bhar neend nahi aayi, sir bhaari hai."],
  fam_h=["{rel} bol rahe the raat ko neend nahi aati, 3 baje se jaage rehte hain.", "{rel} din mein bahut sote hain ab, shayad raat ko neend poori nahi hoti."],
  fam_e=["{rel} says they wake up around 3 AM and cannot go back to sleep.", "{rel} seems to doze through the day, probably from poor nights."]),
 "low_mood": dict(
  q=["Aajkal mann kaisa rehta hai aapka? Koi baat pareshan karti hai?", "Mann halka rehta hai ya kabhi udaas sa lagta hai? Bejhijhak bataiye."],
  pos_m=["Mann thoda udaas sa rehta hai beta, kuch karne ka dil nahi karta.", "Bas aise hi, mann bhaari-bhaari sa hai."],
  pos_s=["Bahut udaas hai mann, kisi se baat karne ka bhi mann nahi karta. Sab bekaar sa lagta hai.", "Rona sa aata rehta hai, pata nahi kyun. Ab kisi cheez mein mann nahi lagta."],
  neg=["Nahi beta, mann theek hai, bachchon se baat ho gayi aaj.", "Sab badhiya hai, mann khush hai."],
  hist=["Kuch din pehle mann bahut udaas tha, ab thoda behtar hai."],
  ack_m=["Main samajh{ta|ti} hoon ji. Mann ki baat batane ke liye dhanyavaad. Hum roz thodi baat karte rahenge."],
  ack_s=["Aapne apne mann ki baat batayi, ye achha kiya. Aap akele nahi hain ji. Main aapke parivaar ko bata{oonga|oongi}, aur hamare counsellor se bhi baat karwane ka intezaam kar{unga|ungi}."],
  voice=["Beta, aaj mann bahut bhaari hai, kisi se baat karne ka mann tha isliye sandesh bheja."],
  fam_h=["{rel} ki awaaz mein pehle jaisa utsaah nahi hai, kaafi low lag rahe the.", "Bahut chup chup rehne lage hain {rel}, pehle itna baat karte the."],
  fam_e=["{rel} sounded low and quieter than usual during our call.", "{rel} has been withdrawn lately and doesn't talk as much as before."]),
 "loneliness": dict(
  q=["Din mein kisi se milna-julna ho jaata hai? Akelapan toh nahi lagta?", "Ghar mein akele reh kar kaisa lagta hai aajkal?"],
  pos_m=["Haan beta, kabhi-kabhi akelapan lagta hai. Din lamba lagta hai.", "Bachche door hain, ghar soona-soona lagta hai."],
  pos_s=["Bahut akela lagta hai beta, poore din kisi se baat nahi hoti. Koi aata bhi nahi.", "Saara din deewarein dekhte rehte hain, koi baat karne wala nahi hai."],
  neg=["Nahi, akele nahi lagta, padosi aate-jaate rehte hain.", "Sab theek hai, din aaram se kat jaata hai."],
  hist=["Kuch samay pehle bahut akela lagta tha, ab thoda theek hai."],
  ack_m=["Ji, hum hain na aapse baat karne ke liye. Bhajan mandali ya park mein kuch logon se milne ka mann banaiye."],
  ack_s=["Aapki baat sunkar mujhe bura laga ji. Main aapke parivaar aur hamare counsellor ko bata{oonga|oongi}, taaki aapse zyada baat ho sake."],
  voice=["Beta, aaj din bhar kisi se baat nahi hui, isliye bas socha tumse baat kar loon."],
  fam_h=["{rel} ne kaha ki din bhar akele rehte hain, kisi se baat nahi hoti.", "Wo ab park bhi nahi jaate, bol rahe the 'kisse milne jaaun'."],
  fam_e=["{rel} said they barely talk to anyone during the day and feel lonely.", "{rel} has stopped going to the park or meeting friends."]),
 "confusion": dict(
  q=["Aajkal kuch yaad rakhne mein dikkat toh nahi hoti? Jaise din-taareekh ya dawai?", "Aaj kaun sa din hai, yaad hai aapko? Hansi-mazaak mein poochh{ta|ti} hoon."],
  pos_m=["Kabhi-kabhi bhool jaate hain beta, cheezein rakhkar dhoondhte rehte hain.", "Haan, din-taareekh mein thoda gadbad ho jaata hai."],
  pos_s=["Aaj subah dawai li ya nahi, kuch yaad nahi aa raha, bahut uljhan ho rahi hai.", "Kaun sa din hai, ye bhi yaad nahi rehta, sab gadbad ho jaata hai."],
  neg=["Nahi, yaad sab rehta hai mujhe, roz ki ginti bhi rakhta hoon.", "Bilkul theek hai dimaag, kuch nahi bhoolte."],
  hist=[],
  ack_m=["Koi baat nahi ji. Hum sab kabhi-kabhi bhool jaate hain. Main dawai ka samay yaad dilat{a|i} rahoon{ga|gi}."],
  ack_s=["Koi baat nahi ji, ghabraiye mat. Main aapke parivaar ko bata{oonga|oongi} taaki wo aapke saath baithkar dawaiyon ka dabba theek kar dein, aur doctor sahab ko bhi bataya jaaye."],
  voice=["Beta, ye dawai kaun si leni thi, main bhool gaya hoon, batana zara."],
  fam_h=["{rel} aajkal ek hi baat baar baar poochte hain, aur dawai bhi bhool jaate hain.", "Kal {rel} ne kaha unhe date yaad nahi, thoda confuse lag rahe the."],
  fam_e=["{rel} repeats the same questions and forgets medicines lately.", "{rel} seemed confused about the day and date when I called."]),
 "dizziness": dict(
  q=["Uthte-baithte ya chalte samay chakkar jaisa toh nahi aata?", "Sir ghoomne jaisa kuch laga kya aajkal?"],
  pos_m=["Haan, kabhi-kabhi uthte samay halka chakkar aata hai.", "Khade hote hi aankhon ke aage thoda andhera sa ho gaya tha."],
  pos_s=["Kal do baar bahut chakkar aaya, pakadkar baithna pada. Darr lag raha hai girne ka.", "Sir ghoomta rehta hai, theek se chal nahi pa rahe."],
  neg=["Nahi, chakkar-vakkar nahi aata, theek hain."],
  hist=["Pichle hafte ek baar chakkar aaya tha, phir nahi aaya."],
  ack_m=["Ji, uthte samay dheere-dheere uthiyega, pehle thodi der baith jaiye. Main note kar le{ta|ti} hoon."],
  ack_s=["Chakkar aana girne ka khatra badha deta hai, isliye aap akele mat chaliye, kursi ya deewar pakadkar rahiye. Main abhi aapke parivaar ko bata{ta|ti} hoon aur doctor se baat karne ki salaah de{ta|ti} hoon."],
  voice=["Beta, aaj subah chakkar jaisa laga, BP naapa toh machine kuch alag bata rahi thi."],
  fam_h=["{rel} ne bataya ki uthte hi chakkar aa gaya tha, darr lag raha hai gir na jaayein.", "Kal {rel} ko chakkar aaya, unhone khud bola."],
  fam_e=["{rel} mentioned feeling dizzy on standing and is afraid of falling.", "{rel} felt dizzy yesterday and had to sit down."]),
 "breathlessness": dict(
  q=["Saans lene mein koi dikkat toh nahi hoti? Chalne par saans phoolti hai?", "Raat ko letne par saans toh nahi phoolti?"],
  pos_m=["Haan, seedhiyan chadhne par thodi saans phool jaati hai.", "Thoda chalte hi haanf jaate hain."],
  pos_s=["Bahut saans phoolti hai beta, do kadam chalkar rukna padta hai, raat ko takiya ooncha karna padta hai.", "Letne par saans ghutti si hai, baithkar sona pada."],
  neg=["Nahi, saans theek chalti hai."],
  hist=["Pichle hafte halki khaansi thi, saans ab theek hai."],
  ack_m=["Ji, chalte samay beech-beech mein rukkar aaram kar lijiye. Main note kar le{ta|ti} hoon."],
  ack_s=["Saans ki takleef ko halke mein nahi lena chahiye ji. Agar saans zyada phoole ya honth neele padein toh turant 112 par call kijiye. Main abhi aapke parivaar ko bata{ta|ti} hoon aur doctor ko dikhane ki salaah de{ta|ti} hoon."],
  voice=["Beta, raat ko saans phool rahi thi, pairon mein sujan bhi zyada lag rahi hai."],
  fam_h=["{rel} ko chalte waqt saans phoolti hai, kal bola raat ko takiya ooncha karna pada.", "Dekha ki {rel} baat karte karte haanf rahe the."],
  fam_e=["{rel} gets short of breath on short walks and used extra pillows at night.", "{rel} sounded breathless while talking."]),
 "fall": dict(
  q=["Aap kahin phisle ya gire toh nahi? Sach bataiyega ji, koi baat nahi.", "Aajkal chalte samay ladkhadahat ya girne jaisa kuch hua kya?"],
  pos_m=["Thoda ladkhada gaye the, gire nahi, bas sambhal gaye.", "Haan, bathroom mein pair phisla tha, par pakad liya."],
  pos_s=["Haan beta, kal bathroom mein phisal {gaya|gayi}. Thodi chot lagi hai, kamar mein dard hai.", "Raat ko uthte samay gir pade the, bahut dar gaye hain."],
  neg=["Nahi beta, koi girna-virna nahi hua."],
  hist=["Pichle hafte gir gaye the, ab chot theek hai, par darr lagta hai."],
  ack_m=["Ji, dhyan rakhiyega. Bathroom mein chappal sookhi rakhiye aur raat mein light jalakar chaliye."],
  ack_s=["Oh, aapko chot lagi, mujhe bahut dukh hua. Aap abhi aaram se baithiye. Agar chalne mein bahut dard ho ya sir par chot lagi ho toh turant doctor ya 112 ko bulaiye. Main abhi aapke parivaar ko bata{ta|ti} hoon."],
  voice=["Beta, kal raat phisal gaye the, ghabrao mat, zyada nahi lagi."],
  fam_h=["{rel} kal bathroom mein phisal gaye the, unhone mujhe aaj bataya. Please check kar lena.", "Kamar mein chot lagi hai {rel} ko, bol rahe the sab theek hai par chalte waqt dikkat dikh rahi hai."],
  fam_e=["{rel} slipped in the bathroom yesterday and only told me today. Please do check in.", "{rel} hurt the lower back in a fall and says it's fine, but walking looks difficult."]),
 "fever": dict(
  q=["Aaj bukhaar ya thand jaisa toh nahi lag raha? Badan garam hai?", "Tabiyat mein bukhaar jaisi koi baat?"],
  pos_m=["Halka bukhaar sa lagta hai, badan toot raha hai.", "Raat ko thodi haraarat thi."],
  pos_s=["Kal raat se bukhaar hai, badan tap raha hai, thand bhi lag rahi hai.", "Bahut bukhaar hai beta, badan dard bhi hai, khana bhi nahi khaya."],
  neg=["Nahi, bukhaar nahi hai, theek hain."],
  hist=["Kal bukhaar tha, aaj utar gaya hai, thodi kamzori baaki hai."],
  ack_m=["Ji, aaram kijiye aur khoob paani peejiye. Agar thermometer hai toh ek baar naap lijiye."],
  ack_s=["Bukhaar ke saath agar bahut kamzori ya uljhan lage toh doctor ko dikhana zaroori hai ji. Main aapke parivaar ko bata de{ta|ti} hoon."],
  voice=["Beta, bukhaar jaisa lag raha hai, thermometer mein 100 aaya hai."],
  fam_h=["{rel} ko kal raat se bukhaar jaisa lag raha hai, bol rahe the badan toot raha hai.", "Fever aaya hai {rel} ko, dawai ki zaroorat ho toh please arrange kara dena."],
  fam_e=["{rel} has had a fever since last night and body ache.", "{rel} feels feverish; could you check if a doctor visit is needed?"]),
 "swelling": dict(
  q=["Pairon ya takhnon mein sujan toh nahi dikh rahi?", "Joote-chappal aajkal kasate toh nahi?"],
  pos_m=["Haan, shaam tak pairon mein halki sujan aa jaati hai."],
  pos_s=["Pair bahut sooj gaye hain beta, chappal bhi nahi aa rahi, dabane par gaddha pad jaata hai."],
  neg=["Nahi, sujan nahi hai."],
  hist=[],
  ack_m=["Ji, pair ooncha karke baithiyega. Main note kar le{ta|ti} hoon."],
  ack_s=["Pairon ki sujan ke saath wazan badhna theek sanket nahi hai ji, isliye doctor sahab ko jaldi dikhana achha rahega. Main parivaar se baat kar{ta|ti} hoon. Dawai apne aap kam-zyada mat kijiye."],
  voice=["Beta, pairon mein sujan badh gayi hai, wazan bhi zyada aa raha hai machine par."],
  fam_h=["{rel} ke pair kaafi sooje hue lag rahe the video par.", "Weight bhi badh gaya hai {rel} ka, aur saans bhi jaldi phoolti hai."],
  fam_e=["{rel}'s feet looked swollen on the video call.", "{rel} seems to have gained weight and gets breathless easily."]),
 "headache": dict(
  q=["Sir mein dard ya bhaaripan toh nahi hai?", "Aankhon ke aage dhundhlapan ya sirdard jaisa kuch?"],
  pos_m=["Haan, sir thoda bhaari hai aaj."],
  pos_s=["Sir ke peeche bahut dard hai, aankhon ke saamne dhundhla sa bhi lag raha hai."],
  neg=["Nahi, sirdard nahi hai."],
  hist=[],
  ack_m=["Ji, aaram kijiye. Agar BP ki machine hai toh ek baar naap lijiye."],
  ack_s=["Tez sirdard aur dhundhlepan mein BP naapkar aaj hi doctor se baat karna achha rahega ji. Agar bolne mein dikkat ho ya chehra tedha lage toh turant 112 par call kijiye. Main aapke parivaar ko bata rah{a|i} hoon."],
  voice=["Beta, sir mein bahut dard hai, BP 170 aa raha hai machine par."],
  fam_h=["{rel} ne bataya sar mein bahut dard hai aur BP bhi high aa raha hai.", "Subah se headache hai {rel} ko, dawai li ya nahi pata nahi."],
  fam_e=["{rel} has a bad headache and the BP reading was high.", "{rel} has had a headache since morning and is unsure if medicines were taken."]),
 "chest_discomfort": dict(
  q=["Seene mein koi dard, bhaaripan ya ghabrahat toh nahi hui?", "Dil ki dhadkan tez ya ajeeb si toh nahi lagi?"],
  pos_m=["Kal thoda seene mein bhaaripan sa laga tha, phir theek ho gaya."],
  pos_s=["Kal raat seene mein bhaaripan sa laga, paseena bhi aaya, ghabrahat ho rahi thi."],
  neg=["Nahi, seene mein kuch nahi hai, dhadkan theek hai."],
  hist=["Kuch din pehle seene mein dard hua tha, hospital mein ECG theek aaya tha."],
  ack_m=["Ji, agar dobara aisa lage toh doctor ko zaroor bataiyega. Main bhi parivaar ko bata de{ta|ti} hoon."],
  ack_s=["Agar abhi bhi seene mein dard ya bhaaripan ho raha hai, toh kripya turant 112 par call kijiye ya parivaar ko bulaiye. Main bhi abhi aapke parivaar ko bata rah{a|i} hoon."],
  voice=["Beta, kal raat seene mein kuch ajeeb laga tha, ab theek hai, par bata diya."],
  fam_h=["{rel} ne raat ko seene mein bhaaripan bataya, mujhe darr lag raha hai.", "Dil ki dhadkan tez lag rahi thi {rel} ko, please check kar lijiye."],
  fam_e=["{rel} reported chest heaviness last night; I'm quite worried.", "{rel} felt the heart racing and was anxious."]),
 "urinary": dict(
  q=["Peshaab mein koi jalan ya baar-baar jaane ki dikkat toh nahi?", "Peshaab ka rang ya badboo mein koi fark laga?"],
  pos_m=["Haan, thodi jalan si rehti hai, baar-baar jaana padta hai."],
  pos_s=["Bahut jalan hai beta aur raat ko kai baar uthna padta hai, badboo bhi aati hai."],
  neg=["Nahi, sab theek hai."],
  hist=[],
  ack_m=["Ji, paani zyada peejiye. Agar badhe toh doctor ko bataiyega."],
  ack_s=["Ise doctor ko aaj-kal mein dikha lena achha rahega ji, khaaskar bukhaar ya uljhan ho toh. Main parivaar ko bata de{ta|ti} hoon."],
  voice=["Beta, peshaab mein jalan ho rahi hai, doctor ko batana padega."],
  fam_h=["{rel} ko urine mein jalan bata rahe the, aur thode confuse bhi lag rahe hain."],
  fam_e=["{rel} mentioned a burning sensation while urinating and seemed a bit confused."]),
 "medication_issue": dict(
  q=["Dawaiyon ke dibbe mein sab theek hai? Koi dawai khatam toh nahi hui?", "Dawai lene mein koi dikkat toh nahi aa rahi?"],
  pos_m=["Ek dawai khatam hone wali hai beta, parchi nahi mil rahi.", "Kabhi-kabhi dopahar ki goli bhool jaate hain."],
  pos_s=["Do din se koi dawai nahi li, samajh nahi aa raha kaun si kab leni hai. Dabbe mein sab mil gaya.", "Goli khatam ho gayi thi toh isliye nahi li, bazaar ja nahi paaye."],
  neg=["Haan, sab dawaiyaan theek se le rahe hain."],
  hist=[],
  ack_m=["Ji, main parivaar se kehkar dawai mangwane mein madad karwat{a|i} hoon."],
  ack_s=["Koi baat nahi ji. Dawai chhootna theek nahi hai, par ghabraiye mat. Doctor se poochhe bina koi dawai kam-zyada mat kijiyega. Main parivaar ko bata{ta|ti} hoon taaki dawaiyaan aaj hi aa jaayein."],
  voice=["Beta, wo gulabi wali dawai khatam ho gayi hai, mangwa do.", "Beta, dawai ki parchi kahin rakh di, mil nahi rahi."],
  fam_h=["{rel} ne bataya do din se dawai nahi li, strip khatam ho gayi thi.", "Medicine ka dabba bhi theek se nahi bhar paa rahe {rel}, kuch dawaiyaan chhoot rahi hain."],
  fam_e=["{rel} has skipped medicines for two days because a strip ran out.", "{rel} is struggling to organise the pill box; some doses are being missed."]),
}

# =============================================================================================
HOBBY_BANK = {
 "morning_walk": ("Aaj subah sair par gaye the?", "Haan beta, park ka ek chakkar laga aaye.", "Nahi beta, mann nahi kiya. Aise hi baithe rahe."),
 "bhajan_mandali": ("Is hafte bhajan mandali mein jaana hua?", "Haan, kal shaam gaye the, bahut achha laga.", "Nahi, ab jaane ka mann nahi karta."),
 "gardening": ("Aapke paudhon ki dekhbhaal kaisi chal rahi hai?", "Arre beta, gulab mein nayi kaliyan aayi hain!", "Kai din se bagiche mein gaye hi nahi."),
 "reading": ("Aaj akhbaar ya koi kitaab padhi?", "Haan, subah-subah poora akhbaar padh liya.", "Mann hi nahi lagta padhne mein aajkal."),
 "classical_music": ("Aajkal kaun se gaane ya bhajan sun rahe hain?", "Rafi sahab ke purane gaane lagaye the kal.", "Radio toh band hi pada hai."),
 "card_games": ("Doston ke saath taash ki mehfil jami is hafte?", "Haan, Sharma ji ke yahan baithe the kal.", "Nahi, koi bulane bhi nahi aata, hum bhi nahi gaye."),
 "temple_visit": ("Mandir jaana hua is hafte?", "Haan, shaam ko darshan kar aaye.", "Nahi, chalne ki himmat hi nahi hoti."),
 "yoga": ("Yog-pranayam chal raha hai?", "Haan, roz aadha ghanta karte hain.", "Kai din se chhoot gaya hai beta."),
 "carrom": ("Carrom kisi ke saath khela haal mein?", "Haan, pote ke saath khela, wo haar gaya!", "Nahi, mann hi nahi karta."),
 "cooking": ("Aaj khaane mein kya banaya?", "Aaj lauki ki sabzi aur garma-garam roti banayi.", "Bas khichdi bana li, zyada kuch nahi."),
 "grandkids_call": ("Bachchon se video call hui is hafte?", "Haan, kal poti se baat hui, khoob baatein ki.", "Nahi, wo log vyast rehte hain, hum bhi nahi karte."),
}

MED_Q = ["Aaj ki dawaiyaan samay par le leen aapne?", "Aapki roz ki dawai theek se chal rahi hai na? Aaj subah wali li?"]
MED_TAKEN = ["Haan beta, samay par le li.", "Haan, nashte ke baad le li thi.", "Roz lete hain, aaj bhi li."]
MED_MISSED = ["Aaj subah bhool {gaya|gayi}, abhi le let{a|i} hoon.", "Do din se nahi li beta, goli khatam ho gayi thi.", "Raat wali chhoot gayi thi kal."]
MED_UNSURE = ["Pata nahi beta, li thi ya nahi, yaad nahi aa raha.", "Li toh hogi... yaad nahi."]
MED_ACK_OK = ["Bahut achha ji, aise hi samay par lete rahiye."]
MED_ACK_MISS = ["Koi baat nahi ji. Par roz samay par lena zaroori hai. Main yaad dilane ke liye alarm lagwane mein madad kar{unga|ungi}. Aur doctor se poochhe bina koi dawai kam-zyada mat kijiyega."]

EVENT_Q = {
 "fever": ("Kal aapko bukhaar tha. Aaj kaisa lag raha hai?", "Bukhaar toh utar gaya beta, bas thodi kamzori hai.", "Abhi bhi haraarat hai, badan toot raha hai."),
 "surgery": ("Aapke operation ke baad ab kaisa mehsoos ho raha hai? Taanke ya patti mein koi takleef?", "Ab kaafi theek hai, thoda-thoda chal lete hain.", "Abhi dard hai, zyada chal nahi paate, physio wala aaya tha."),
 "minor_fall": ("Pichle dinon aap gir gaye the, ab chot kaisi hai? Chalne mein darr toh nahi lagta?", "Chot theek ho rahi hai beta, bas thoda darr lagta hai.", "Abhi bhi dard hai aur akele chalne mein bahut darr lagta hai."),
 "minor_fall_in_window": ("Aap kuch din pehle gir gaye the, ab kaisa lag raha hai?", "Ab theek hai, chot kam ho gayi hai.", "Dard hai, chalte hue darr lagta hai."),
 "chest_pain_scare": ("Kuch din pehle aapko seene mein dard hua tha. Uske baad se kaisa lag raha hai?", "Tab se dobara nahi hua beta, doctor ne kaha sab theek hai.", "Thodi ghabrahat rehti hai ki dobara na ho jaaye."),
 "cold_cough": ("Aapki sardi-khaansi ab kaisi hai?", "Ab kaafi kam hai, bas halki khaansi bachi hai.", "Abhi bhi khaansi hai, gala baitha hua hai."),
 "bereavement": ("Aapke apnon ke jaane ke baad se main aapke baare mein soch rah{a|i} {tha|thi}. Aap kaise hain ab?", "Mann toh bhaari hai beta, par sambhal rahe hain.", "Bahut soona lagta hai, raat ko neend nahi aati."),
 "hospital_discharge": ("Hospital se lautne ke baad ab kaisa lag raha hai aapko? Dawaiyaan samay par chal rahi hain?", "Theek hoon beta, dheere-dheere taaqat aa rahi hai.", "Abhi bahut kamzori hai, saans bhi thodi phoolti hai."),
}

GREET_OPEN = ["Namaste {hon}! Main {cname}, Samarth se bol {raha|rahi} hoon. Kaise hain aap?",
              "Namaste {hon}, {cname} bol {raha|rahi} hoon Samarth se. Aap kaise hain aaj?",
              "Ji namaste {hon}! Main {cname}. Aapse thodi der baat kar sak{ta|ti} hoon? Koi jaldi toh nahi hai?"]
GREET_REPLY = ["Namaste beta, theek hain. Tum batao.", "Namaste-namaste, haan bolo beta.", "Arre namaste {addr}, achha kiya phone kiya."]
GREET_REPLY_TERSE = ["Haan, theek hain.", "Namaste. Haan boliye.", "Hmm, haan."]
OBJ_OPEN = {
 "routine_wellbeing": "Bas aapka haal-chaal jaanne ke liye phone kiya hai. Koi jaldi nahi hai, aaram se baat karenge.",
 "follow_up_acute": "Pichli baar aapne {issue} ke baare mein bataya tha. Usi ke baare mein poochhne ke liye phone kiya hai.",
 "post_event_followup": "Aapki tabiyat ke baare mein jaanna tha, jo pichle dinon pareshani hui thi.",
 "medication_verification": "Aaj aapki dawaiyon ke baare mein thodi baat karni thi. Koi ghabrane ki baat nahi hai.",
 "vitals_followup": "Aapki machine ke pichle kuch dinon ke reading dekhe the, unhi ke baare mein thoda poochhna tha.",
 "engagement_checkin": "Kuch dinon se aapki awaaz suni nahi, isliye socha haal poochh loon.",
 "address_family_concern": "Aapke {fam_rel} ne aapki chinta jatayi thi, toh maine socha aapse baat kar loon.",
}
SMALLTALK = ["Kal pote ka phone aaya tha beta, bahut der baat hui, mann khush ho gaya.", "Aajkal baarish bahut ho rahi hai, ghar mein hi baithe rehte hain.",
             "Pados ki Sharma ji ki bahu milne aayi thi kal.", "TV par purane gaane aa rahe the, wahi dekhte rahe.",
             "Aaj chai badi achhi bani thi, bahu ki yaad aa gayi.", "Mandi se taazi sabzi aayi hai aaj.", "Bachchon ke bina ghar soona lagta hai, par kya karein."]
SMALLTALK_ACK = ["Arre wah, sunkar achha laga.", "Bahut achha ji.", "Haan ji, bilkul."]
SENIOR_QUERIES = [("Beta, mera {child} kab aayega? Kuch bataya usne?", "Main unse baat karke aapko bata{unga|ungi} ji. Aap chinta mat kijiye."),
                  ("Agli baar kab phone karogi beta?", "Ji, main agle hafte isi samay phone kar{unga|ungi}."),
                  ("Doctor ke paas jaana hai, koi gaadi ka intezaam ho jaayega?", "Ji, main parivaar se baat karke dekh{ta|ti} hoon ki kaise ho sakta hai.")]
SENIOR_COMPLAINTS = [("Beta, tum log thoda tez bolte ho, mujhe theek se samajh nahi aata.", "Maaf kijiye ji, main dheere-dheere bol{unga|ungi}. Aap beech mein kabhi bhi rokkar poochh lijiyega."),
                     ("Phone khaane ke samay aata hai, tab pareshani hoti hai.", "Ji, maaf kijiye. Aap bataiye kis samay phone karna theek rahega, main usi samay kar{unga|ungi}.")]
TERSE = ["Hmm.", "Theek hai.", "Haan.", "Pata nahi.", "Chalta hai."]
OK_ACK = ["Achha, ye achhi baat hai.", "Theek hai ji.", "Bahut badhiya."]
CLOSE_OPEN = ["Theek hai {hon}, aaj ki baat ye rahi: {recap}. Main {nxt} phir phone kar{unga|ungi}. Apna dhyan rakhiyega.",
              "{hon}, aapse baat karke achha laga. {recap}. {nxt} phir baat karenge. Dhyan rakhiyega."]
CLOSE_REPLY = ["Theek hai beta, jeeti raho.", "Haan beta, tum bhi dhyan rakhna.", "Theek hai."]
DAYS_HI = ["Somvaar", "Mangalvaar", "Budhvaar", "Guruvaar", "Shukravaar", "Shanivaar", "Ravivaar"]

# ---- voice-note (non-symptom) banks
VN_REFILL = ["Beta, {drug} khatam hone wali hai, zara mangwa dena.", "Namaste beti, meri {drug} ki goli do din ki bachi hai. Nayi kab aayegi?"]
VN_GREET = ["Namaste beta! {fest}. Bhagwan aapko khush rakhe.", "{fest} beta, parivaar ko bhi meri taraf se badhai dena."]
VN_QUERY = ["Beta, doctor ke paas kab jaana hai, mujhe taareekh yaad nahi rehti.", "Namaste beta, meri report aa gayi kya?"]
VN_CHAT = ["Namaste beta, aaj subah ki sair par bada achha laga, socha tumhe bata doon.", "Beta, aaj gulab mein pehla phool khila hai, mann khush ho gaya!",
           "Beta, kal bhajan mandali mein bahut maza aaya, tum bhi aana kabhi."]
VN_COMPLAINT = ["Beta, ye wale coordinator bahut tez bolte hain, mujhe samajh nahi aata. Thoda dheere bolne ko kehna."]
VN_BP = ["Beta, aaj BP {sbp} par {dbp} aaya hai machine mein, theek hai na?"]
VN_LONELY = ["Beta, aaj kisi se baat nahi hui din bhar, isliye tumhe sandesh bhej rah{a|i} hoon."]

# =============================================================================================
# family message bank (Hinglish & English)
FAM_GENERIC_POS_H = ["{rel} aaj kaafi khush lag rahe the, humne der tak baat ki. Sab theek lag raha hai.",
                     "Weekend pe {rel} se baat hui, bol rahe the walk pe jaate hain roz. Achha laga sunke."]
FAM_GENERIC_POS_E = ["{rel} sounded cheerful today and we chatted for long. All seems fine.",
                     "Spoke to {rel} over the weekend - they said they are walking daily. Good to hear."]
FAM_Q_H = ["Kya aap {rel} ki BP/sugar readings ka weekly summary bhej sakte ho?", "Kya {rel} ko roz ek baar dawai ke liye yaad dila sakte hain?",
           "Next week {rel} ka checkup hai, kya cab arrange ho jayegi?", "Ye knee pain physiotherapy se theek ho sakta hai kya? Koi achha physio bata sakte ho?",
           "{rel} ka khana kaisa chal raha hai, kuch pata chala?"]
FAM_Q_E = ["Could you share a weekly summary of {rel}'s BP/sugar readings?", "Can you remind {rel} daily about the medicines?",
           "{rel} has a checkup next week - can a cab be arranged?", "Could physiotherapy help with this knee pain? Can you suggest someone?",
           "How is {rel} eating these days? Any idea?"]
FAM_LOG_H = ["{rel} ko Saturday ko Dr. ke paas jaana hai, 11 baje ka appointment hai. Please cab ka dhyan rakhna.", "Is hafte {rel} ke blood tests hone hain, kya lab wala ghar aa sakta hai?"]
FAM_LOG_E = ["{rel} has a doctor's appointment on Saturday at 11. Please coordinate the cab.", "Blood tests are due for {rel} this week - can a lab technician visit home?"]
FAM_COMPLAINT_H = ["{rel} keh rahe the ki coordinator bahut tez bolte hain, unhe samajh nahi aata. Please thoda slow bolne ko kehna.",
                   "{rel} ko aapka call kabhi lunch ke time aata hai, wo thoda disturb ho jaate hain.",
                   "Bar bar same sawal poochte hain aap log, {rel} kabhi kabhi chid jaate hain."]
FAM_COMPLAINT_E = ["{rel} says the coordinator speaks too fast and they can't follow. Could you please speak slower?",
                   "Your calls sometimes come at lunch time and {rel} gets disturbed.",
                   "{rel} feels the same questions are repeated every call and gets irritated."]
FAM_ANX_H = ["Mujhe kaafi tension ho rahi hai, pichle kuch dino se kuch theek nahi lag raha. Please sach batana, kuch chhupana mat.",
             "Main door hoon isliye dar lagta hai. {rel} sach mein theek hain na?"]
FAM_ANX_E = ["I'm quite worried - something hasn't felt right for a few days. Please tell me honestly, don't hide anything.",
             "Being far away makes me anxious. Is {rel} really okay?"]
FAM_MED_H = ["{rel} ne kaha dawai do din se nahi li, kya aap dekh sakte ho?", "Pillbox mein dawai waise ki waisi padi hai, lagta hai {rel} le nahi rahe."]
FAM_MED_E = ["{rel} said they haven't taken medicines for two days. Could you look into it?", "The pill box still looks full - I think {rel} is skipping doses."]
FAM_WITHHOLD_H = ["Please {rel} ko mat batana ki maine aapse baat ki, wo naraaz ho jaate hain.", "{rel} ne mana kiya hai BP ki baat mujhe batane se. Aap handle kar lena please."]
FAM_WITHHOLD_E = ["Please don't tell {rel} that I spoke to you - they get upset.", "{rel} asked me not to discuss the BP issue with family. Please handle it gently."]
FAM_THANKS_H = ["Thank you aapka, {rel} aapke call ka intezaar karte hain.", "Aap logon ki wajah se hum door rehkar bhi nishchint rehte hain, shukriya."]
FAM_THANKS_E = ["Thank you - {rel} looks forward to your calls.", "Because of you we feel at ease even from far away. Grateful."]
FAM_UPDATE_H = ["Koi update hai kya aaj {rel} ke baare mein?", "Is hafte ka summary mil jaaye toh achha rahega."]
FAM_UPDATE_E = ["Any update on {rel} today?", "It would be great to get this week's summary."]
