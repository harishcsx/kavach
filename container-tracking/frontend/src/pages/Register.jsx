import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Register = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post('http://localhost:5000/auth/register', { name, email, password, role: 'MANUFACTURER' });
            alert("Registration successful! You can now log in.");
            navigate('/login');
        } catch (e) {
            alert(e.response?.data?.error || "Registration failed");
        }
    };

    return (
        <div className="login-wrapper">
            <div className="login-card">
                <h2>📝 Manufacturer Registration</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Full Name</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                    </div>
                    <button className="btn btn-green" type="submit">Register as Manufacturer</button>
                    <p style={{ textAlign: 'center', marginTop: '16px', color: '#6b7280', fontSize: '0.9rem' }}>
                        Already have an account? <a href="/login" className="link">Log in</a>
                    </p>
                </form>
            </div>
        </div>
    );
};

export default Register;
