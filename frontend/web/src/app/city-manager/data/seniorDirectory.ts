// Senior Directory & Helper metadata for the City Manager Operations Dashboard

export interface DialogueTurn {
  speaker: "Assistant" | "Senior";
  text: string;
  hindi_text?: string;
  time: string;
}

export interface SeniorDirectoryMeta {
  senior_id: string;
  name: string;
  age: number;
  gender: "Female" | "Male";
  city: string;
  address: string;
  primary_phone: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  avatar_url: string;
  status: "Active" | "Needs Attention" | "Under Review";
  risk_level: "URGENT" | "HIGH" | "MODERATE" | "LOW";
  last_checkin_time: string;
  next_visit_time: string;
  next_dose_time: string;
  next_medication_name: string;
  meds_taken: number;
  meds_total: number;
  vitals: {
    bp: string;
    bp_status: string;
    sugar: string;
    sugar_status: string;
    weight: string;
    weight_status: string;
  };
  recent_ai_call: {
    time_label: string;
    status: string;
    duration: string;
    summary: string;
    clinical_flags: Array<{
      label: string;
      type: "warning" | "success" | "info";
    }>;
    dialogue: DialogueTurn[];
  };
  active_alert_banner?: {
    title: string;
    description: string;
    severity: "URGENT" | "HIGH" | "MEDIUM";
  };
}

export const SENIOR_DIRECTORY: Record<string, SeniorDirectoryMeta> = {
  S0054: {
    senior_id: "S0054",
    name: "Savitri Devi",
    age: 75,
    gender: "Female",
    city: "Delhi",
    address: "B-42, Defence Colony, New Delhi",
    primary_phone: "+91 98112 34567",
    emergency_contact_name: "Rajesh Verma (Son)",
    emergency_contact_phone: "+91 98112 78901",
    avatar_url: "/images/seniors/elder_woman_1.jpg",
    status: "Active",
    risk_level: "HIGH",
    last_checkin_time: "Today 9:14 AM",
    next_visit_time: "Today 2:00 PM",
    next_dose_time: "2:00 PM",
    next_medication_name: "Prescribed Daily Medicine (Amlodipine 5mg)",
    meds_taken: 2,
    meds_total: 3,
    vitals: {
      bp: "122/71",
      bp_status: "Normal",
      sugar: "125 mg/dL",
      sugar_status: "Normal",
      weight: "70 kg",
      weight_status: "Stable",
    },
    active_alert_banner: {
      title: "Daily step drop with reported weakness",
      description: "Daily step count averaged only 55% of senior's personal baseline over 3 consecutive days. Check-in dialogue note captured active complaints of unusual weakness or physical exhaustion.",
      severity: "HIGH",
    },
    recent_ai_call: {
      time_label: "Today, 9:00 AM",
      status: "Completed",
      duration: "1m 45s",
      summary: "Automated daily wellness check-in completed. Senior reported mild physical fatigue after waking up. Confirmed taking morning BP medication. Caretaker visit scheduled for 2:00 PM.",
      clinical_flags: [
        { label: "Mild Fatigue Reported", type: "warning" },
        { label: "Morning BP Med Taken", type: "success" },
        { label: "Appetite Slightly Low", type: "warning" },
        { label: "Normal Speech Cadence", type: "info" },
      ],
      dialogue: [
        {
          speaker: "Assistant",
          hindi_text: "नमस्ते सावित्री जी! मैं प्रिया बोल रही हूँ समर्थ केयर से। आज सुबह आपकी तबीयत कैसी है?",
          text: "Namaste Savitriji! This is Priya from Sahaj Care. How are you feeling this morning?",
          time: "09:00:05",
        },
        {
          speaker: "Senior",
          hindi_text: "नमस्ते बेटा। सब ठीक है, बस आज सुबह बिस्तर से उठने के बाद थोड़ी ज्यादा थकान और कमजोरी सी लग रही है।",
          text: "Namaste beta. I am alright, just feeling a bit more tired and weak than usual after getting out of bed.",
          time: "09:00:22",
        },
        {
          speaker: "Assistant",
          hindi_text: "मैं समझ सकती हूँ सावित्री जी। क्या आपने सुबह का नाश्ता किया और अपनी ब्लड प्रेशर वाली सफेद गोली समय पर ले ली?",
          text: "I understand Savitriji. Did you have breakfast and take your morning blood pressure white tablet on time?",
          time: "09:00:38",
        },
        {
          speaker: "Senior",
          hindi_text: "हाँ, हल्का दलिया खाया और गोली पानी के साथ ले ली थी। पर आज भूख थोड़ी कम लगी है।",
          text: "Yes, I had light daliya and took the tablet with water. But my appetite was a bit lower today.",
          time: "09:00:54",
        },
        {
          speaker: "Assistant",
          hindi_text: "बताने के लिए बहुत धन्यवाद सावित्री जी। हमारे केयरटेकर दीपक कुमार आज दोपहर 2:00 बजे आकर आपका बीपी और वाइटल्स चेक करेंगे। तब तक आप आराम कीजियेगा।",
          text: "Thank you for letting me know, Savitriji. Caretaker Deepak Kumar will visit today at 2:00 PM to check your BP and vitals. Please rest until then.",
          time: "09:01:12",
        },
        {
          speaker: "Senior",
          hindi_text: "हाँ बेटा, बहुत शुक्रिया। मैं घर पर ही आराम कर रही हूँ।",
          text: "Yes dear, thank you so much. I will rest at home.",
          time: "09:01:25",
        },
      ],
    },
  },
  S0071: {
    senior_id: "S0071",
    name: "Rameshwar Prasad Gupta",
    age: 64,
    gender: "Male",
    city: "Delhi",
    address: "C-18, Hauz Khas, New Delhi",
    primary_phone: "+91 98103 45678",
    emergency_contact_name: "Sunil Gupta (Son)",
    emergency_contact_phone: "+91 98103 89012",
    avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=256",
    status: "Active",
    risk_level: "HIGH",
    last_checkin_time: "Today 8:45 AM",
    next_visit_time: "Today 3:30 PM",
    next_dose_time: "1:00 PM",
    next_medication_name: "Metformin 500mg & Telmisartan 40mg",
    meds_taken: 1,
    meds_total: 3,
    vitals: {
      bp: "138/88",
      bp_status: "Elevated",
      sugar: "142 mg/dL",
      sugar_status: "Slightly High",
      weight: "74 kg",
      weight_status: "Stable",
    },
    active_alert_banner: {
      title: "Elevated blood pressure observed in check-in note",
      description: "Sensor metrics and check-in call indicate mild dizziness when standing quickly. Recommended caretaker verification.",
      severity: "HIGH",
    },
    recent_ai_call: {
      time_label: "Today, 8:45 AM",
      status: "Completed",
      duration: "1m 30s",
      summary: "Senior mentioned feeling slight dizziness after sudden standing. Morning sugar 142 mg/dL logged. Hydration reminder provided.",
      clinical_flags: [
        { label: "Postural Dizziness", type: "warning" },
        { label: "Sugar 142 mg/dL", type: "warning" },
        { label: "Hydration Advised", type: "info" },
      ],
      dialogue: [
        {
          speaker: "Assistant",
          hindi_text: "नमस्ते रामेश्वर जी! समर्थ केयर से प्रिया। आज सुबह आपकी सेहत कैसी है?",
          text: "Namaste Rameshwarji! Priya from Sahaj Care. How is your health this morning?",
          time: "08:45:04",
        },
        {
          speaker: "Senior",
          hindi_text: "नमस्ते प्रिया जी। सब ठीक है, बस सोफे से उठते समय हल्का सा चक्कर जैसा लगा था।",
          text: "Namaste Priyaji. Overall fine, but felt a momentary lightheadedness when getting up from the sofa.",
          time: "08:45:20",
        },
        {
          speaker: "Assistant",
          hindi_text: "रामेश्वर जी, कृपया एकदम से न उठें। 2 गिलास गुनगुना पानी पियें। केयरटेकर दोपहर को बीपी नापने आ रहे हैं।",
          text: "Rameshwarji, please avoid rising abruptly. Please drink 2 glasses of warm water. Caretaker is scheduled this afternoon to measure BP.",
          time: "08:45:40",
        },
      ],
    },
  },
  S0012: {
    senior_id: "S0012",
    name: "Kamala Sharma",
    age: 78,
    gender: "Female",
    city: "Noida / Bengaluru",
    address: "12, Sector 15A, Noida",
    primary_phone: "+91 98101 23456",
    emergency_contact_name: "Rohit Sharma (Son)",
    emergency_contact_phone: "+91 98101 65432",
    avatar_url: "/images/seniors/elder_woman_2.jpg",
    status: "Active",
    risk_level: "MODERATE",
    last_checkin_time: "Today 9:14 AM",
    next_visit_time: "Today 2:00 PM",
    next_dose_time: "2:00 PM",
    next_medication_name: "BP Medicine (Amlodipine 5mg)",
    meds_taken: 2,
    meds_total: 3,
    vitals: {
      bp: "128/82",
      bp_status: "Normal",
      sugar: "102 mg/dL",
      sugar_status: "Normal",
      weight: "60 kg",
      weight_status: "Stable",
    },
    active_alert_banner: {
      title: "Unusual fatigue reported today",
      description: "Senior mentioned feeling more tired than usual. Monitor closely.",
      severity: "HIGH",
    },
    recent_ai_call: {
      time_label: "Today, 9:14 AM",
      status: "Completed",
      duration: "1m 42s",
      summary: "Senior reported mild fatigue. Appetite slightly low. Took morning medication. No major concerns.",
      clinical_flags: [
        { label: "Mild Fatigue Reported", type: "warning" },
        { label: "Morning BP Med Taken", type: "success" },
        { label: "Appetite Moderate", type: "info" },
      ],
      dialogue: [
        {
          speaker: "Assistant",
          hindi_text: "नमस्ते कमला जी! समर्थ केयर से प्रिया। आज सुबह आपकी तबीयत कैसी है?",
          text: "Namaste Kamalaji! This is Priya from Sahaj Care. How are you feeling this morning?",
          time: "09:14:02",
        },
        {
          speaker: "Senior",
          hindi_text: "नमस्ते बेटा। ठीक हूँ, बस सुबह उठने पर थोड़ी ज्यादा थकान महसूस हो रही है।",
          text: "Namaste beta. I am alright, just feeling a bit more tired than usual today after getting out of bed.",
          time: "09:14:15",
        },
        {
          speaker: "Assistant",
          hindi_text: "मैं समझ सकती हूँ कमला जी। क्या आपने सुबह की बीपी की दवा ले ली?",
          text: "I understand Kamalaji. Did you manage to take your morning blood pressure tablet and have breakfast?",
          time: "09:14:24",
        },
        {
          speaker: "Senior",
          hindi_text: "हाँ, टोस्ट खाया था और गोली भी ले ली।",
          text: "Yes, I had toast and warm milk, and took the white tablet. I didn't feel very hungry though.",
          time: "09:14:41",
        },
        {
          speaker: "Assistant",
          hindi_text: "केयरटेकर दोपहर 2:00 बजे आकर बीपी चेक करेंगे। आप तब तक आराम कीजियेगा।",
          text: "Caretaker will visit at 2:00 PM to check your vitals. Please rest well until then.",
          time: "09:14:58",
        },
      ],
    },
  },
  S0004: {
    senior_id: "S0004",
    name: "Ramesh Sen",
    age: 73,
    gender: "Male",
    city: "Bengaluru",
    address: "45, 12th Main, Indiranagar, Bengaluru",
    primary_phone: "+91 98450 12345",
    emergency_contact_name: "Ananya Sen (Daughter)",
    emergency_contact_phone: "+91 98450 67890",
    avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=256",
    status: "Active",
    risk_level: "URGENT",
    last_checkin_time: "Today 8:30 AM",
    next_visit_time: "Today 10:00 AM",
    next_dose_time: "1:00 PM",
    next_medication_name: "Metformin 500mg",
    meds_taken: 1,
    meds_total: 3,
    vitals: {
      bp: "138/88",
      bp_status: "Elevated",
      sugar: "142 mg/dL",
      sugar_status: "Slightly High",
      weight: "68 kg",
      weight_status: "Stable",
    },
    active_alert_banner: {
      title: "Acute slip/fall incident recorded",
      description: "Senior or coordinator check-in note confirmed an acute slip or fall incident; daily steps dropped sharply.",
      severity: "URGENT",
    },
    recent_ai_call: {
      time_label: "Today, 8:30 AM",
      status: "Completed",
      duration: "2m 10s",
      summary: "Senior mentioned slipping near bathroom yesterday night. Minor knee swelling reported. Caretaker visit dispatched.",
      clinical_flags: [
        { label: "Fall/Slip Incident", type: "warning" },
        { label: "Knee Pain", type: "warning" },
        { label: "Urgent Visit Dispatched", type: "info" },
      ],
      dialogue: [
        {
          speaker: "Assistant",
          text: "Namaste Rameshji, how did you sleep last night? We noticed you took fewer steps than usual.",
          time: "08:30:05",
        },
        {
          speaker: "Senior",
          text: "I had a slip in the bathroom around 11 PM. Slipped on wet tiles.",
          time: "08:30:20",
        },
        {
          speaker: "Assistant",
          text: "Are you in severe pain or unable to bear weight? We will dispatch Caretaker immediately.",
          time: "08:30:35",
        },
      ],
    },
  },
  S0021: {
    senior_id: "S0021",
    name: "Kavita Mehta",
    age: 67,
    gender: "Female",
    city: "Mumbai / Bengaluru",
    address: "78, Juhu Tara Road, Mumbai",
    primary_phone: "+91 98200 23456",
    emergency_contact_name: "Amit Mehta (Son)",
    emergency_contact_phone: "+91 98200 78901",
    avatar_url: "/images/seniors/elder_woman_1.jpg",
    status: "Active",
    risk_level: "HIGH",
    last_checkin_time: "Today 10:15 AM",
    next_visit_time: "Today 11:30 AM",
    next_dose_time: "2:30 PM",
    next_medication_name: "Thyroxine 75mcg",
    meds_taken: 1,
    meds_total: 2,
    vitals: {
      bp: "124/80",
      bp_status: "Normal",
      sugar: "110 mg/dL",
      sugar_status: "Normal",
      weight: "58 kg",
      weight_status: "Stable",
    },
    active_alert_banner: {
      title: "Missed scheduled check-in",
      description: "Missed scheduled visit; no check-in received from assigned caretaker within SLA.",
      severity: "HIGH",
    },
    recent_ai_call: {
      time_label: "Today, 10:15 AM",
      status: "Completed",
      duration: "1m 15s",
      summary: "Senior answered AI check-in call on second attempt. Confirmed feeling okay, waiting for visit.",
      clinical_flags: [
        { label: "Caretaker Delayed", type: "warning" },
        { label: "Senior Safe", type: "success" },
      ],
      dialogue: [
        {
          speaker: "Assistant",
          text: "Namaste Kavitaji, checking in to make sure your caretaker visit was attended.",
          time: "10:15:10",
        },
        {
          speaker: "Senior",
          text: "Nobody has arrived yet beta, I called Deepak but got voicemail.",
          time: "10:15:28",
        },
      ],
    },
  },
};

export function getSeniorMetadata(seniorId?: string | null): SeniorDirectoryMeta {
  if (seniorId && SENIOR_DIRECTORY[seniorId]) {
    return SENIOR_DIRECTORY[seniorId];
  }

  // Graceful Indian senior generator for any senior ID
  const idStr = seniorId || "S0001";
  const num = parseInt(idStr.replace(/\D/g, "") || "1", 10);
  const isFemale = num % 2 === 0;

  const femaleNames = ["Savitri Devi", "Kamala Sharma", "Saraswati Devi", "Shanti Bai", "Pushpa Gupta", "Nirmala Verma", "Kanta Devi", "Usha Saxena"];
  const maleNames = ["Ramesh Sen", "Rameshwar Prasad", "Prem Nath Gupta", "Harish Chandra", "Kailash Nath", "Brij Mohan", "Jagdish Prasad", "Devendra Kumar"];

  const femaleElderPics = [
    "/images/seniors/elder_woman_1.jpg",
    "/images/seniors/elder_woman_2.jpg",
  ];
  const maleElderPics = [
    "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?auto=format&fit=crop&q=80&w=350",
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=350",
    "https://images.unsplash.com/photo-1552058544-f2b08422138a?auto=format&fit=crop&q=80&w=350",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=350",
  ];

  const chosenName = isFemale ? femaleNames[num % femaleNames.length] : maleNames[num % maleNames.length];
  const avatarUrl = isFemale
    ? femaleElderPics[num % femaleElderPics.length]
    : maleElderPics[num % maleElderPics.length];

  return {
    senior_id: idStr,
    name: chosenName,
    age: 68 + (num % 18),
    gender: isFemale ? "Female" : "Male",
    city: "New Delhi",
    address: `B-${20 + (num % 50)}, Care Sector, New Delhi`,
    primary_phone: `+91 9811${(10000 + num).toString().slice(0, 5)}`,
    emergency_contact_name: isFemale ? "Rajesh Verma (Son)" : "Sunil Gupta (Son)",
    emergency_contact_phone: `+91 9811${(70000 + num).toString().slice(0, 5)}`,
    avatar_url: avatarUrl,
    status: "Active",
    risk_level: "HIGH",
    last_checkin_time: "Today 9:00 AM",
    next_visit_time: "Today 2:00 PM",
    next_dose_time: "2:00 PM",
    next_medication_name: "Prescribed Daily Medicine",
    meds_taken: 2,
    meds_total: 3,
    vitals: {
      bp: `${120 + (num % 15)}/${72 + (num % 12)}`,
      bp_status: "Normal",
      sugar: `${100 + (num % 35)} mg/dL`,
      sugar_status: "Normal",
      weight: `${58 + (num % 20)} kg`,
      weight_status: "Stable",
    },
    active_alert_banner: {
      title: "Daily step drop with reported weakness",
      description: "Daily step count averaged below baseline over 3 consecutive days. Check-in dialogue note captured active complaints of unusual weakness or physical exhaustion.",
      severity: "HIGH",
    },
    recent_ai_call: {
      time_label: "Today, 9:00 AM",
      status: "Completed",
      duration: "1m 45s",
      summary: "Automated daily wellness check-in completed. Senior reported mild physical fatigue after waking up. Confirmed taking morning BP medication. Caretaker visit scheduled for 2:00 PM.",
      clinical_flags: [
        { label: "Mild Fatigue Reported", type: "warning" },
        { label: "Morning BP Med Taken", type: "success" },
        { label: "Appetite Normal", type: "info" },
        { label: "Voice Cadence Clear", type: "info" },
      ],
      dialogue: [
        {
          speaker: "Assistant",
          hindi_text: `नमस्ते ${chosenName} जी! मैं प्रिया बोल रही हूँ समर्थ केयर से। आज सुबह आपकी तबीयत कैसी है?`,
          text: `Namaste ${chosenName}ji! This is Priya from Sahaj Care. How are you feeling this morning?`,
          time: "09:00:05",
        },
        {
          speaker: "Senior",
          hindi_text: "नमस्ते बेटा। ठीक हूँ, बस आज सुबह बिस्तर से उठने के बाद थोड़ी ज्यादा थकान महसूस हो रही है।",
          text: "Namaste beta. I am alright, just feeling a bit more tired than usual after getting out of bed.",
          time: "09:00:22",
        },
        {
          speaker: "Assistant",
          hindi_text: "मैं समझ सकती हूँ जी। क्या आपने सुबह की दवा ले ली और हल्का नाश्ता किया?",
          text: "I understand. Did you take your morning medication and have light breakfast?",
          time: "09:00:38",
        },
        {
          speaker: "Senior",
          hindi_text: "हाँ, दलिया खाया और गोली पानी के साथ ले ली थी।",
          text: "Yes, had breakfast and took the medicine with water.",
          time: "09:00:54",
        },
        {
          speaker: "Assistant",
          hindi_text: "बहुत बढ़िया। हमारे केयरटेकर आज दोपहर 2:00 बजे आकर बीपी नापेंगे। तब तक आप आराम कीजिये।",
          text: "Very good. Our caretaker will visit today at 2:00 PM to measure your BP. Please rest until then.",
          time: "09:01:12",
        },
      ],
    },
  };
}
