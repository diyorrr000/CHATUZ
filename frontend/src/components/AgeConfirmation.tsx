import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface UserData {
    age: string;
    country: string;
}

interface AgeConfirmationProps {
    onConfirm: (data: UserData) => void;
}

const countryGroups = [
    { label: "Global", countries: ["Dunyo bo'ylab (Global)"] },
    { label: "Markaziy Osiyo", countries: ["O'zbekiston", "Qozog'iston", "Qirg'iziston", "Tojikiston"] },
    { label: "Boshqa", countries: ["Rossiya", "Ukraina", "Turkiya", "Ozarbayjon", "Germaniya", "AQSh"] }
];

const ageRanges = ["18-24", "25-34", "35-44", "45+"];

const AgeConfirmation: React.FC<AgeConfirmationProps> = ({ onConfirm }) => {
    const [age, setAge] = useState(ageRanges[0]);
    const [country, setCountry] = useState("Dunyo bo'ylab (Global)");

    return (
        <div className="landing-overlay">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="landing-card"
            >
                {/* Logo Section */}
                <div className="landing-logo">
                    <div style={{ width: '60px', height: '60px', border: '4px dashed rgba(255,255,255,0.4)', borderRadius: '50%', animation: 'spin 10s linear infinite' }}></div>
                </div>

                <h1 style={{ fontSize: '48px', fontWeight: '900', margin: '0 0 10px' }}>CHATUZ</h1>

                <div className="online-status">
                    <div className="online-dot"></div>
                    <span>3,284 foydalanuvchi onlayn</span>
                </div>

                <p style={{ fontSize: '18px', fontWeight: '500', marginBottom: '30px', opacity: 0.8 }}>Yangi do'stlar orttiring</p>

                <div style={{ marginBottom: '30px' }}>
                    <select
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="input-select"
                    >
                        {countryGroups.map(group => (
                            <optgroup key={group.label} label={group.label}>
                                {group.countries.map(c => <option key={c} value={c}>{c}</option>)}
                            </optgroup>
                        ))}
                    </select>

                    <select
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        className="input-select"
                    >
                        {ageRanges.map(a => <option key={a} value={a}>{a} yoshdagilar</option>)}
                    </select>
                </div>

                <button
                    onClick={() => onConfirm({ age, country })}
                    className="btn-start"
                >
                    BOSHLASH
                </button>

                <div style={{ marginTop: '20px', opacity: 0.5, fontSize: '10px' }}>
                    <p style={{ fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '5px' }}>
                        Men 18 yoshga to'lganimni tasdiqlayman
                    </p>
                    <a href="#" style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 'bold' }}>FOYDALANUVCHI SHARTNOMASI</a>

                    <p style={{ marginTop: '20px', fontSize: '11px' }}>
                        Dasturchi: <span style={{ opacity: 1 }}>SHONAZAROV DIYORBEK</span>
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

export default AgeConfirmation;
