import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';

import AddResourcePage from './pages/AddResourcePage';
import EditResourcePage from './pages/EditResourcePage';
import ResourceDetailsPage from './pages/ResourceDetailsPage';

import TicketDashboard from './pages/TicketDashboard';
import CreateTicket from './pages/CreateTicket';
import TicketDetail from './pages/TicketDetail';
import TechnicianTickets from './auth/user/TechnicianTickets';


import Login from './auth/auths/Login';
import Signup from './auth/auths/Signup';
import VerifyOtp from './auth/auths/VerifyOtp';
import OAuth2Success from './auth/auths/OAuth2Success';
import Dashboard from './auth/user/Dashboard';
import ForgotPassword from './auth/user/ForgotPassword';
import Home from './auth/user/Home';
import TechHome from './auth/user/TechHome';
import Profile from './auth/user/Profile';
import Settings from './auth/user/Settings';


import BookingPage from './pages/BookingPage';
import MyBookingsPage from './pages/MyBookingsPage';
import AdminBookingsPage from './pages/AdminBookingsPage';
import LandingPage from './pages/LandingPage';


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard/resources/add" element={<AddResourcePage />} />
        <Route path="/dashboard/resources/edit/:id" element={<EditResourcePage />} />
        <Route path="/dashboard/resources/:id" element={<ResourceDetailsPage />} />

        <Route path="/resources" element={<Navigate to="/dashboard" replace />} />
        <Route path="/resources/add" element={<AddResourcePage />} />
        <Route path="/resources/edit/:id" element={<EditResourcePage />} />
        <Route path="/resources/:id" element={<ResourceDetailsPage />} />


          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/oauth-success" element={<OAuth2Success />} />
          <Route path="/verify" element={<VerifyOtp />} />
          <Route path="/verify-email" element={<VerifyOtp />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/home" element={<Home />} />
          <Route path="/techhome" element={<TechHome />} />
          <Route path="/techome" element={<Navigate to="/techhome" replace />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />

          <Route path="/bookings" element={<BookingPage />} />
          <Route path="/my-bookings" element={<MyBookingsPage />} />
          <Route path="/admin/bookings" element={<AdminBookingsPage />} />
          

          <Route path="/tickets" element={<TicketDashboard />} />
          <Route path="/tickets/create" element={<CreateTicket />} />
          <Route path="/tickets/:id" element={<TicketDetail />} />
          <Route path="/admin/tickets" element={<TicketDashboard />} />
          <Route path="/admin/tickets/create" element={<CreateTicket />} />
          <Route path="/admin/tickets/:id" element={<TicketDetail />} />
          <Route path="/technician/my-tickets" element={<TechnicianTickets />} />
          <Route path="/technician/appointments" element={<TechnicianTickets />} />
      </Routes>
    </Router>
  </React.StrictMode>,
);
