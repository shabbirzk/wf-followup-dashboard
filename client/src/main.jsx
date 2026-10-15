import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import "./style.css";

const API =
  import.meta.env.VITE_API_URL ||
  "https://wf-followup-api1.onrender.com/api";

const TODO_TASK_TITLE_OPTIONS = [
  "Email checking/Reply/Response",
  "Quotation to be prepare",
  "Delivery Schedule for sales order",
  "B2B Order Followup",
  "Requisition/showroom set up Schedule",
  "Layout/Presentation to be prepare",
  "Follow-up call/WhatsApp/email to client",
  "Sales Inquiry to be check",
  "Follow-up for Transit Orders/Stock arrival",
  "Follow-up for Natuzzi Recap",
  "Price Tag prepration",
  "Damage Form/Survey prepration"
];

/* =========================================================
   DUBAI TIMEZONE HELPERS
========================================================= */

const DUBAI_TIMEZONE = "Asia/Dubai";

const fmt = (value) => {
  if (!value) return "";

  return new Date(value).toLocaleString("en-GB", {
    timeZone: DUBAI_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
};

const getDubaiDate = (value = new Date()) => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DUBAI_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
};

const getDubaiToday = () => {
  return getDubaiDate(new Date());
};

const dubaiLocalToISO = (localValue) => {
  if (!localValue) return "";

  const [datePart, timePart] = localValue.split("T");

  if (!datePart || !timePart) return "";

  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  // Dubai = UTC+4
  const utcMillis = Date.UTC(
    year,
    month - 1,
    day,
    hour - 4,
    minute
  );

  return new Date(utcMillis).toISOString();
};

const isoToDubaiLocal = (value) => {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DUBAI_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
