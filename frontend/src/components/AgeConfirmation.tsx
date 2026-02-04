import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Globe, User } from 'lucide-react';

interface UserData {
    age: string;
    country: string;
}

interface AgeConfirmationProps {
    onConfirm: (data: UserData) => void;
}

const countryGroups = [
    {
        label: "Global",
        countries: ["Dunyo bo'ylab (Global)"]
    },
    {
        label: "Markaziy Osiyo",
        countries: ["O'zbekiston", "Qozog'iston", "Qirg'iziston", "Tojikiston"]
    },
    {
        label: "Eng Faol Mintaqalar",
        countries: ["Rossiya", "Ukraina", "Turkiya", "Ozarbayjon"]
    },
    {
        label: "Janubiy Osiyo",
        countries: ["Hindiston", "Pokiston", "Bangladesh", "Shri-Lanka"]
    },
    {
        label: "Yevropa",
        countries: ["Germaniya", "Fransiya", "Italiya", "Ispaniya", "Polsha"]
    },
    {
        label: "Amerika",
        countries: ["AQSh", "Kanada", "Braziliya", "Meksika"]
    },
    {
        label: "Afrika",
        countries: ["Misr", "Marokash", "Nigeriya", "Janubiy Afrika"]
    },
    {
        label: "Sharqiy Osiyo",
        countries: ["Indoneziya", "Filippin", "Vyetnam", "Tailand"]
    }
];

const ageRanges = [
    "18-24", "25-34", "35-44", "45+"
];

const AgeConfirmation: React.FC<AgeConfirmationProps> = ({ onConfirm }) => {
    const [age, setAge] = useState(ageRanges[0]);
    const [country, setCountry] = useState("Dunyo bo'ylab (Global)");

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(15px)' }}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="glass p-8 max-w-md w-full text-center space-y-6"
                style={{ padding: '2.5rem', maxWidth: '480px', width: '100%', textAlign: 'center' }}
            >
                <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '0.5rem', background: 'linear-gradient(to right, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-2px' }}>
                    CHATUZ
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '1.1rem', marginBottom: '1.5rem' }}>
                    Jahon bo'ylab yangi do'stlar orttiring!
                </p>

                <div className="flex flex-col gap-4 text-left">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm text-gray-400 flex items-center gap-2">
                            <Globe size={14} /> Qidiruv hududi:
                        </label>
                        <select
                            value={country}
                            onChange={(e) => setCountry(e.target.value)}
                            className="w-full"
                        >
                            {countryGroups.map(group => (
                                <optgroup key={group.label} label={group.label}>
                                    {group.countries.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm text-gray-400 flex items-center gap-2">
                            <User size={14} /> Yoshingiz:
                        </label>
                        <select
                            value={age}
                            onChange={(e) => setAge(e.target.value)}
                            className="w-full"
                        >
                            {ageRanges.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
                    <button
                        className="primary-btn pulse"
                        onClick={() => onConfirm({ age, country })}
                        style={{ fontSize: '1.2rem', padding: '16px' }}
                    >
                        Boshlash
                    </button>
                    <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                        Ushbu platforma 18+ foydalanuvchilar uchun. "Boshlash"ni bosish orqali siz buni tasdiqlaysiz.
                    </p>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default AgeConfirmation;
