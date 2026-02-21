import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { login, user } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        const success = await login(email, password);
        if (success) {
            // route based on role. In real app we wait for auth state
            setTimeout(() => navigate('/manufacturer'), 500); // hardcoding manufacturer for demo
        } else {
            alert("Login failed");
        }
    };

    return (
        <div className="max-w-md mx-auto mt-20 bg-white p-8 rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold mb-6 text-center text-blue-600">System Login</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-gray-700 font-medium">Email</label>
                    <input
                        type="email"
                        className="w-full mt-1 p-2 border rounded-lg focus:ring focus:ring-blue-300"
                        value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div>
                    <label className="block text-gray-700 font-medium">Password</label>
                    <input
                        type="password"
                        className="w-full mt-1 p-2 border rounded-lg focus:ring focus:ring-blue-300"
                        value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
                <button className="w-full bg-blue-600 text-white p-2 rounded-lg font-bold hover:bg-blue-700 transition">
                    Sign In
                </button>
            </form>
        </div>
    );
};

export default Login;
