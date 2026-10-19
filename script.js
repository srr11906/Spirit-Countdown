const CONFIG = {
    releaseDate: new Date("2027-10-29T00:00:00+05:30").getTime(),
    tickRate: 1000,
    animationClass: "flip"
};

const elements = {
    days: document.getElementById("days"),
    hours: document.getElementById("hours"),
    minutes: document.getElementById("minutes"),
    seconds: document.getElementById("seconds")
};

let lastValues = {
    days: null,
    hours: null,
    minutes: null,
    seconds: null
};

function format(value) {
    return String(value).padStart(2, "0");
}

function animate(el, value, key) {
    if (lastValues[key] === value) return;

    el.classList.remove(CONFIG.animationClass);
    void el.offsetWidth;
    el.textContent = format(value);
    el.classList.add(CONFIG.animationClass);

    lastValues[key] = value;
}

function updateCountdown() {
    const now = Date.now();
    const diff = CONFIG.releaseDate - now;

    if (diff <= 0) {
        Object.values(elements).forEach(el => el.textContent = "00");
        return;
    }

    const time = {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60)
    };

    animate(elements.days, time.days, "days");
    animate(elements.hours, time.hours, "hours");
    animate(elements.minutes, time.minutes, "minutes");
    animate(elements.seconds, time.seconds, "seconds");
}

updateCountdown();
setInterval(updateCountdown, CONFIG.tickRate);

document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        updateCountdown();
    }
});

const calendarBtn = document.getElementById("calendar-btn");
const calendarModal = document.getElementById("calendar-modal");
const closeModal = document.getElementById("close-modal");
const googleCal = document.getElementById("google-cal");
const icalCal = document.getElementById("ical-cal");
const shareBtn = document.getElementById("share-btn");
const toast = document.getElementById("toast");

let toastTimer = null;

function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.hidden = true;
    }, 2500);
}

if (calendarBtn && calendarModal) {
    calendarBtn.addEventListener("click", () => {
        calendarModal.hidden = false;
    });

    closeModal.addEventListener("click", () => {
        calendarModal.hidden = true;
    });

    calendarModal.addEventListener("click", (e) => {
        if (e.target === calendarModal) {
            calendarModal.hidden = true;
        }
    });

    window.addEventListener("keydown", (e) => {
        if (e.code === "Escape" && !calendarModal.hidden) {
            calendarModal.hidden = true;
        }
    });


    const googleUrl = "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" +
        encodeURIComponent("Spirit Movie Release — Prabhas") +
        "&dates=20271029/20271030&details=" +
        encodeURIComponent("The Mighty Man marches on October 29, 2027. Directed by Sandeep Reddy Vanga. #OneBadHabit") +
        "&location=" + encodeURIComponent("Cinemas Worldwide");
    googleCal.href = googleUrl;

    icalCal.addEventListener("click", () => {
        const icsContent = "BEGIN:VCALENDAR\n" +
            "VERSION:2.0\n" +
            "PRODID:-//Spirit Countdown//EN\n" +
            "BEGIN:VEVENT\n" +
            "UID:spirit-20271029@countdown\n" +
            "DTSTAMP:20261019T000000Z\n" +
            "DTSTART;VALUE=DATE:20271029\n" +
            "DTEND;VALUE=DATE:20271030\n" +
            "SUMMARY:Spirit Movie Release — Prabhas\n" +
            "DESCRIPTION:The Mighty Man marches on October 29, 2027. Directed by Sandeep Reddy Vanga. #OneBadHabit\n" +
            "LOCATION:Cinemas Worldwide\n" +
            "STATUS:CONFIRMED\n" +
            "END:VEVENT\n" +
            "END:VCALENDAR";

        const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "spirit-release.ics";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        calendarModal.hidden = true;
        showToast("Calendar event downloaded!");
    });
}

if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
        const days = elements.days.textContent;
        const text = `Only ${days} Days left until Prabhas marches with #Spirit! 🔥 #OneBadHabit`;
        const url = window.location.href;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: "Spirit Countdown",
                    text: text,
                    url: url
                });
            } catch (err) {}
        } else if (navigator.clipboard) {
            try {
                await navigator.clipboard.writeText(`${text} ${url}`);
                showToast("Countdown & link copied!");
            } catch (err) {
                showToast(text);
            }
        } else {
            showToast(text);
        }
    });
}
