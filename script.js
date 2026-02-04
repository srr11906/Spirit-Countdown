const CONFIG = {
    releaseDate: new Date("2027-03-05T00:00:00+05:30").getTime(),
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
