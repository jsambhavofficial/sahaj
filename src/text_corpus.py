"""Corpus of realistic Hindi, English, and Hinglish check-in notes and clinical cues."""

from typing import List, Dict, Any, NamedTuple


class CueAnnotation(NamedTuple):
    cue_type: str
    cue_value: str
    temporal_context: str
    negation_status: bool
    confidence: float = 0.95


class TextTemplate(NamedTuple):
    language: str
    text: str
    cues: List[CueAnnotation]


# Diverse corpus of phrases across categories
CORPUS: Dict[str, List[TextTemplate]] = {
    # 1. Normal Wellbeing (no new concern)
    "wellbeing": [
        TextTemplate("hindi", "आज सब ठीक है, सुबह पार्क में टहलने गए थे।", [CueAnnotation("no_new_concern", "present", "current", False)]),
        TextTemplate("hindi", "सब कुशल मंगल है, कोई परेशानी या दिक्कत नहीं है।", [CueAnnotation("no_new_concern", "present", "current", False)]),
        TextTemplate("hindi", "तबीयत एकदम सामान्य है, दिनचर्या अच्छी चल रही है।", [CueAnnotation("no_new_concern", "present", "current", False)]),
        TextTemplate("hinglish", "Aaj sab theek hai, morning walk bhi acche se kiya.", [CueAnnotation("no_new_concern", "present", "current", False)]),
        TextTemplate("hinglish", "Everything is normal, koi weakness ya problem nahi hai.", [
            CueAnnotation("no_new_concern", "present", "current", False),
            CueAnnotation("weakness", "absent", "current", True)
        ]),
        TextTemplate("hinglish", "Sab badhiya hai beta, routine follow kar rahe hain.", [CueAnnotation("no_new_concern", "present", "current", False)]),
        TextTemplate("english", "Feeling quite active and well today. Slept peacefully.", [CueAnnotation("no_new_concern", "present", "current", False)]),
        TextTemplate("english", "Doing well today, went out to the garden in the morning.", [CueAnnotation("no_new_concern", "present", "current", False)]),
        TextTemplate("english", "No health complaints today, feeling fresh.", [CueAnnotation("no_new_concern", "present", "current", False)]),
    ],

    # 2. Weakness and Fatigue
    "weakness": [
        TextTemplate("hindi", "पिछले दो दिनों से शरीर में बहुत सुस्ती और कमजोरी लग रही है।", [CueAnnotation("weakness", "present", "current", False)]),
        TextTemplate("hindi", "उठने-बैठने में बहुत थकावट महसूस हो रही है, हाथ-पैर में जान नहीं लग रही।", [CueAnnotation("weakness", "present", "current", False)]),
        TextTemplate("hinglish", "Bahut zyada weakness feel ho rahi hai subah se, bistar se uthne ka man nahi kiya.", [CueAnnotation("weakness", "present", "current", False)]),
        TextTemplate("hinglish", "Body me kaafi thakaan hai aur walking karte waqt fatigue ho raha hai.", [CueAnnotation("weakness", "present", "current", False)]),
        TextTemplate("english", "Feeling unusually fatigued and low on physical stamina since yesterday.", [CueAnnotation("weakness", "present", "current", False)]),
        TextTemplate("english", "Struggled with generalized body weakness, stayed in bed most of morning.", [CueAnnotation("weakness", "present", "current", False)]),
    ],

    # 3. Reduced Appetite
    "low_appetite": [
        TextTemplate("hindi", "दो दिन से खाना खाने की बिल्कुल इच्छा नहीं हो रही, भूख बहुत कम है।", [CueAnnotation("low_appetite", "present", "current", False)]),
        TextTemplate("hindi", "खाने का स्वाद नहीं आ रहा, सिर्फ आधा कटोरी दलिया खाया।", [CueAnnotation("low_appetite", "present", "current", False)]),
        TextTemplate("hinglish", "Bhookh bilkul nahi lag rahi hai, dinner skip kar diya kal raat.", [CueAnnotation("low_appetite", "present", "current", False)]),
        TextTemplate("hinglish", "Appetite bahut drop ho gayi hai, bas chai aur ek biscuit liya.", [CueAnnotation("low_appetite", "present", "current", False)]),
        TextTemplate("english", "Poor appetite reported, only ate a few spoonfuls of porridge.", [CueAnnotation("low_appetite", "present", "current", False)]),
        TextTemplate("english", "Has not felt hungry all day and skipped lunch entirely.", [CueAnnotation("low_appetite", "present", "current", False)]),
    ],

    # 4. Poor Sleep
    "poor_sleep": [
        TextTemplate("hindi", "कल रात बिल्कुल नींद नहीं आई, बेचैनी में बार-बार आँख खुलती रही।", [CueAnnotation("poor_sleep", "present", "current", False)]),
        TextTemplate("hindi", "रात भर करवटें बदलते रहे, सिर भारी लग रहा है नींद न पूरी होने से।", [CueAnnotation("poor_sleep", "present", "current", False)]),
        TextTemplate("hinglish", "Kal raat proper sleep nahi aayi, 2 baje ke baad se jag rahe the.", [CueAnnotation("poor_sleep", "present", "current", False)]),
        TextTemplate("hinglish", "Neend bohot disturbed rahi night me, restlessness thi.", [CueAnnotation("poor_sleep", "present", "current", False)]),
        TextTemplate("english", "Unable to fall asleep until early morning hours due to restlessness.", [CueAnnotation("poor_sleep", "present", "current", False)]),
        TextTemplate("english", "Severe sleep disruption last night, feeling groggy and tired.", [CueAnnotation("poor_sleep", "present", "current", False)]),
    ],

    # 5. Pain
    "pain": [
        TextTemplate("hindi", "घुटनों और कमर में काफी तेज दर्द है, चलने में सहारा लेना पड़ रहा है।", [CueAnnotation("pain", "present", "current", False)]),
        TextTemplate("hindi", "जोड़ों का दर्द बढ़ गया है, दवाई लेने पर भी आराम नहीं मिल रहा।", [CueAnnotation("pain", "present", "current", False)]),
        TextTemplate("hinglish", "Right knee me sharp pain hai, stairs chadhna impossible ho gaya hai.", [CueAnnotation("pain", "present", "current", False)]),
        TextTemplate("hinglish", "Lower back pain bohot badh gaya hai do din se.", [CueAnnotation("pain", "present", "current", False)]),
        TextTemplate("english", "Complaining of persistent moderate aching pain in knees and hips.", [CueAnnotation("pain", "present", "current", False)]),
        TextTemplate("english", "Severe joint stiffness and joint pain restricting daily mobility.", [CueAnnotation("pain", "present", "current", False)]),
    ],

    # 6. Low Mood and Loneliness
    "low_mood": [
        TextTemplate("hindi", "आज मन बहुत उदास है, घर में बिल्कुल अकेलापन महसूस हो रहा है।", [
            CueAnnotation("low_mood", "present", "current", False),
            CueAnnotation("loneliness", "present", "current", False)
        ]),
        TextTemplate("hindi", "किसी से बात करने की इच्छा नहीं हो रही, मन भारी सा है।", [CueAnnotation("low_mood", "present", "current", False)]),
        TextTemplate("hinglish", "Mood kaafi low hai aaj, ghar par akelapan bohot lag raha hai.", [
            CueAnnotation("low_mood", "present", "current", False),
            CueAnnotation("loneliness", "present", "current", False)
        ]),
        TextTemplate("hinglish", "Man udas hai aur helpless feel ho raha hai.", [CueAnnotation("low_mood", "present", "current", False)]),
        TextTemplate("english", "Senior seemed emotionally low and expressed feelings of intense loneliness.", [
            CueAnnotation("low_mood", "present", "current", False),
            CueAnnotation("loneliness", "present", "current", False)
        ]),
        TextTemplate("english", "Appeared dispirited and tearful during check-in conversation.", [CueAnnotation("low_mood", "present", "current", False)]),
    ],

    # 7. Confusion
    "confusion": [
        TextTemplate("hindi", "आज सुबह की दवा ली या नहीं, कुछ याद नहीं आ रहा, बहुत भ्रम हो रहा है।", [
            CueAnnotation("confusion", "present", "current", False),
            CueAnnotation("medication_issue", "uncertain", "current", False)
        ]),
        TextTemplate("hindi", "बातों में थोड़ा भटकाव लग रहा था, आज का दिन और तारीख भूल गए थे।", [CueAnnotation("confusion", "present", "current", False)]),
        TextTemplate("hinglish", "Bohot confusion ho raha tha, morning dose li thi ya nahi dhyan nahi raha.", [
            CueAnnotation("confusion", "present", "current", False),
            CueAnnotation("medication_issue", "uncertain", "current", False)
        ]),
        TextTemplate("hinglish", "Thoda disoriented lag rahe the call par, baatein repeat kar rahe the.", [CueAnnotation("confusion", "present", "current", False)]),
        TextTemplate("english", "Exhibited noticeable disorientation regarding time and recent meals.", [CueAnnotation("confusion", "present", "current", False)]),
        TextTemplate("english", "Confused between yesterday and today's schedule during check-in.", [CueAnnotation("confusion", "present", "current", False)]),
    ],

    # 8. Dizziness
    "dizziness": [
        TextTemplate("hindi", "कुर्सी से खड़े होते ही अचानक सिर चकरा गया और आँखों के आगे अंधेरा छा गया।", [CueAnnotation("dizziness", "present", "current", False)]),
        TextTemplate("hindi", "हल्का चक्कर आ रहा है, संतुलन बनाने में कठिनाई लग रही है।", [CueAnnotation("dizziness", "present", "current", False)]),
        TextTemplate("hinglish", "Achanak se chakkar sa aaya khade hote waqt, so wapas baith gaye.", [CueAnnotation("dizziness", "present", "current", False)]),
        TextTemplate("hinglish", "Feeling dizzy while walking towards the kitchen.", [CueAnnotation("dizziness", "present", "current", False)]),
        TextTemplate("english", "Experienced an episode of postural dizziness when rising from bed.", [CueAnnotation("dizziness", "present", "current", False)]),
        TextTemplate("english", "Complained of unsteadiness and lightheadedness throughout morning.", [CueAnnotation("dizziness", "present", "current", False)]),
    ],

    # 9. Reported Falls
    "fall": [
        TextTemplate("hindi", "कल रात बाथरूम के पास पैर फिसल गया था और गिर पड़े, शुक्र है कोई फ्रैक्चर नहीं हुआ।", [CueAnnotation("fall", "present", "historical", False)]),
        TextTemplate("hindi", "सुबह बरामदे में चलते-चलते गिर गए थे, घुटने में हल्की चोट आई है।", [CueAnnotation("fall", "present", "current", False)]),
        TextTemplate("hinglish", "Kal shaam ko room me slip hokar gir gaye the, abhi thoda sambhal gaye hain.", [CueAnnotation("fall", "present", "historical", False)]),
        TextTemplate("hinglish", "Bathroom ke paas slip ho gaye the subah, floor wet tha.", [CueAnnotation("fall", "present", "current", False)]),
        TextTemplate("english", "Reported a mechanical slip and fall incident near the bathroom entrance.", [CueAnnotation("fall", "present", "current", False)]),
        TextTemplate("english", "Senior informed coordinator of a slip and fall occurrence yesterday evening.", [CueAnnotation("fall", "present", "historical", False)]),
    ],

    # 10. Medication Difficulties
    "medication_issue": [
        TextTemplate("hindi", "दवाई की डिब्बी खोलने में हाथ कांप रहा था, इसलिए दोपहर की गोली छूट गई।", [CueAnnotation("medication_issue", "present", "current", False)]),
        TextTemplate("hindi", "दवाइयों के पत्तों में उलझन हो गई थी, कौन सी लेनी है समझ नहीं आया।", [CueAnnotation("medication_issue", "present", "current", False)]),
        TextTemplate("hinglish", "Strips confuse ho gayi thi so noon wali tablet miss ho gayi.", [CueAnnotation("medication_issue", "present", "current", False)]),
        TextTemplate("hinglish", "Medicine box open karna difficult lagta hai, fingers me stiffness hai.", [CueAnnotation("medication_issue", "present", "current", False)]),
        TextTemplate("english", "Reported difficulty handling medication blister pack and missed midday dose.", [CueAnnotation("medication_issue", "present", "current", False)]),
        TextTemplate("english", "Senior was unsure if heart medication was taken this morning.", [CueAnnotation("medication_issue", "uncertain", "current", False)]),
    ],

    # 11. Negated Symptoms
    "negation": [
        TextTemplate("hindi", "मुझे किसी तरह का कोई दर्द या कमजोरी नहीं है, बिल्कुल ठीक हूँ।", [
            CueAnnotation("pain", "absent", "current", True),
            CueAnnotation("weakness", "absent", "current", True),
            CueAnnotation("no_new_concern", "present", "current", False)
        ]),
        TextTemplate("hindi", "भूख में कोई कमी नहीं है और चक्कर भी नहीं आ रहे।", [
            CueAnnotation("low_appetite", "absent", "current", True),
            CueAnnotation("dizziness", "absent", "current", True),
            CueAnnotation("no_new_concern", "present", "current", False)
        ]),
        TextTemplate("hinglish", "Mujhe koi dard nahi hai, aur sleep bhi proper aayi thi.", [
            CueAnnotation("pain", "absent", "current", True),
            CueAnnotation("poor_sleep", "absent", "current", True),
            CueAnnotation("no_new_concern", "present", "current", False)
        ]),
        TextTemplate("hinglish", "Koi weakness ya chakkar feel nahi ho raha, feeling fresh.", [
            CueAnnotation("weakness", "absent", "current", True),
            CueAnnotation("dizziness", "absent", "current", True),
            CueAnnotation("no_new_concern", "present", "current", False)
        ]),
        TextTemplate("english", "Denies any chest pain, shortness of breath, or dizziness today.", [
            CueAnnotation("pain", "absent", "current", True),
            CueAnnotation("dizziness", "absent", "current", True),
            CueAnnotation("no_new_concern", "present", "current", False)
        ]),
        TextTemplate("english", "No complaints of weakness or appetite loss reported this morning.", [
            CueAnnotation("weakness", "absent", "current", True),
            CueAnnotation("low_appetite", "absent", "current", True),
            CueAnnotation("no_new_concern", "present", "current", False)
        ]),
    ],

    # 12. Historical Symptoms
    "historical": [
        TextTemplate("hindi", "पिछले हफ्ते चक्कर आए थे लेकिन अब पूरी तरह ठीक हूँ।", [
            CueAnnotation("dizziness", "present", "historical", False),
            CueAnnotation("no_new_concern", "present", "current", False)
        ]),
        TextTemplate("hindi", "दो हफ्ते पहले पीठ में दर्द था जो अब ठीक हो गया है।", [
            CueAnnotation("pain", "present", "historical", False),
            CueAnnotation("no_new_concern", "present", "current", False)
        ]),
        TextTemplate("hinglish", "Last week fall hua tha but abhi balance normal hai.", [
            CueAnnotation("fall", "present", "historical", False),
            CueAnnotation("no_new_concern", "present", "current", False)
        ]),
        TextTemplate("hinglish", "Pichhle month knee pain zyada tha, abhi manageable hai.", [
            CueAnnotation("pain", "present", "historical", False)
        ]),
        TextTemplate("english", "Mentioned having a dizzy spell last Tuesday which has since resolved.", [
            CueAnnotation("dizziness", "present", "historical", False),
            CueAnnotation("no_new_concern", "present", "current", False)
        ]),
        TextTemplate("english", "Had experienced severe back ache two weeks ago, currently pain-free.", [
            CueAnnotation("pain", "present", "historical", False),
            CueAnnotation("no_new_concern", "present", "current", False)
        ]),
    ],

    # 13. Uncertain Symptoms
    "uncertain": [
        TextTemplate("hindi", "शायद कल रात की दवा छूट गई थी, पक्का याद नहीं आ रहा।", [
            CueAnnotation("medication_issue", "uncertain", "historical", False)
        ]),
        TextTemplate("hindi", "शरीर थोड़ा भारी सा लग रहा है, पता नहीं थकावट है या मौसम का असर।", [
            CueAnnotation("weakness", "uncertain", "current", False)
        ]),
        TextTemplate("hinglish", "Shayad BP thoda high feel ho raha hai, but confirm nahi kiya machine se.", [
            CueAnnotation("dizziness", "uncertain", "current", False)
        ]),
        TextTemplate("hinglish", "Lagta hai neend thodi adhoori thi, par sure nahi hoon.", [
            CueAnnotation("poor_sleep", "uncertain", "current", False)
        ]),
        TextTemplate("english", "Unsure whether morning dose was completed prior to breakfast.", [
            CueAnnotation("medication_issue", "uncertain", "current", False)
        ]),
        TextTemplate("english", "Reported feeling slightly off-balance, though uncertain if clinically significant.", [
            CueAnnotation("dizziness", "uncertain", "current", False)
        ]),
    ],

    # 14. Recovery and Follow-up
    "recovery": [
        TextTemplate("hindi", "डॉक्टर और को-ऑर्डिनेटर की सलाह के बाद अब भूख और ताकत में काफी सुधार है।", [
            CueAnnotation("no_new_concern", "present", "current", False),
            CueAnnotation("weakness", "absent", "current", True)
        ]),
        TextTemplate("hindi", "नियमित फिजियोथेरेपी से चलने-फिरने में काफी आसानी हो रही है।", [
            CueAnnotation("no_new_concern", "present", "current", False)
        ]),
        TextTemplate("hinglish", "Coordinator ke visit ke baad routine streamline ho gayi, feeling energetic.", [
            CueAnnotation("no_new_concern", "present", "current", False),
            CueAnnotation("weakness", "absent", "current", True)
        ]),
        TextTemplate("hinglish", "Pain ab kafi kam ho gaya hai new ointment se, walk kar paa rahe hain.", [
            CueAnnotation("pain", "absent", "current", True),
            CueAnnotation("no_new_concern", "present", "current", False)
        ]),
        TextTemplate("english", "Noticeable positive recovery observed following coordinator intervention and diet review.", [
            CueAnnotation("no_new_concern", "present", "current", False)
        ]),
        TextTemplate("english", "Mobility and sleep quality have rebounded significantly this week.", [
            CueAnnotation("no_new_concern", "present", "current", False),
            CueAnnotation("poor_sleep", "absent", "current", True)
        ]),
    ],
}

