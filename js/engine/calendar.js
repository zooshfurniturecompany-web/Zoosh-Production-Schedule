/**
 * Calendar & Date Engine
 * Real calendar date calculation, weekday handling, leap years, Sunday exclusions, and working day progression.
 */
window.Zoosh = window.Zoosh || {};

window.Zoosh.Calendar = {
  /**
   * Parse YYYY-MM-DD or ISO string to standard UTC/Local normalized Date
   */
  parseDate(dateInput) {
    if (!dateInput) return new Date();
    if (dateInput instanceof Date) return new Date(dateInput.getTime());
    if (typeof dateInput === 'string') {
      const parts = dateInput.split('T')[0].split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 9, 0, 0);
      }
    }
    return new Date(dateInput);
  },

  /**
   * Format Date to YYYY-MM-DD
   */
  formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * Format Date to user-friendly string: "28 Sep 2026" or "Mon, 28 Sep"
   */
  formatDisplayDate(dateInput, includeWeekday = true, includeYear = true) {
    if (!dateInput) return '—';
    const d = this.parseDate(dateInput);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    const dayName = weekdays[d.getDay()];
    const dayNum = String(d.getDate()).padStart(2, '0');
    const monthName = months[d.getMonth()];
    const year = d.getFullYear();

    if (includeWeekday && includeYear) {
      return `${dayName}, ${dayNum} ${monthName} ${year}`;
    } else if (includeWeekday && !includeYear) {
      return `${dayName} ${dayNum} ${monthName}`;
    } else if (!includeWeekday && includeYear) {
      return `${dayNum} ${monthName} ${year}`;
    }
    return `${dayNum} ${monthName}`;
  },

  /**
   * Check if a date is Sunday (0)
   */
  isSunday(dateInput) {
    const d = this.parseDate(dateInput);
    return d.getDay() === 0;
  },

  /**
   * Check if a date is a non-working factory day
   */
  isNonWorkingDay(dateInput) {
    const d = this.parseDate(dateInput);
    const nonWorking = (window.Zoosh.Config && window.Zoosh.Config.NON_WORKING_DAYS) || [0];
    return nonWorking.includes(d.getDay());
  },

  /**
   * Add calendar days to a date
   */
  addCalendarDays(dateInput, days) {
    const d = this.parseDate(dateInput);
    d.setDate(d.getDate() + days);
    return d;
  },

  /**
   * Difference in whole calendar days (date2 - date1)
   */
  diffCalendarDays(date1Input, date2Input) {
    const d1 = this.parseDate(date1Input);
    const d2 = this.parseDate(date2Input);
    const utcD1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
    const utcD2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
    return Math.round((utcD2 - utcD1) / (1000 * 60 * 60 * 24));
  },

  /**
   * Get days in specific month (handles leap years correctly)
   */
  getDaysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  },

  /**
   * Generate array of days for Month View
   */
  getMonthDays(year, monthIndex) {
    const totalDays = this.getDaysInMonth(year, monthIndex);
    const days = [];
    const todayStr = window.Zoosh.Config.CURRENT_DATE;
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(year, monthIndex, day, 9, 0, 0);
      const dateStr = this.formatDate(d);
      const dayOfWeek = d.getDay();
      days.push({
        date: d,
        dateStr: dateStr,
        dayNumber: day,
        weekday: weekdays[dayOfWeek],
        isSunday: dayOfWeek === 0,
        isNonWorking: dayOfWeek === 0,
        isToday: dateStr === todayStr
      });
    }
    return days;
  },

  /**
   * Generate array of 7 days around a date for Week View
   */
  getWeekDays(centerDateInput) {
    const center = this.parseDate(centerDateInput);
    // Find the Monday of this week
    const dayOfWeek = center.getDay(); // 0 is Sunday, 1 is Monday...
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(center);
    monday.setDate(center.getDate() + diffToMonday);

    const days = [];
    const todayStr = window.Zoosh.Config.CURRENT_DATE;
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = this.formatDate(d);
      const dow = d.getDay();
      days.push({
        date: d,
        dateStr: dateStr,
        dayNumber: d.getDate(),
        weekday: weekdays[dow],
        isSunday: dow === 0,
        isNonWorking: dow === 0,
        isToday: dateStr === todayStr
      });
    }
    return days;
  },

  /**
   * Advance a start date by working duration in days (supports decimals: 1, 1.25, 2.5 etc.)
   * Skips Sundays and handles daily working hours (default 8 hrs/day).
   * 
   * @param {string|Date} startDateStr 
   * @param {number} durationDays e.g. 1.25 days = 10 hours
   * @param {Array<string>} [unavailableDates=[]] Dates when employee is on leave
   * @returns {Object} { endDateStr, totalCalendarDays, scheduledSegments }
   */
  calculateWorkingSpan(startDateStr, durationDays, unavailableDates = []) {
    let curr = this.parseDate(startDateStr);
    const standardHours = (window.Zoosh.Config && window.Zoosh.Config.STANDARD_WORK_HOURS_PER_DAY) || 8;
    let remainingHours = Math.max(0.1, Number(durationDays) * standardHours);
    
    const unavailableSet = new Set(unavailableDates || []);
    const scheduledSegments = [];
    
    // Safety limit to prevent infinite loops
    let safetyCounter = 0;
    while (remainingHours > 0 && safetyCounter < 100) {
      safetyCounter++;
      const dateStr = this.formatDate(curr);
      const isSun = this.isSunday(curr);
      const isLeave = unavailableSet.has(dateStr);

      if (!isSun && !isLeave) {
        // Factory is open and employee is available
        const hoursThisDay = Math.min(remainingHours, standardHours);
        const startHour = 9;
        const endHour = 9 + hoursThisDay;
        
        scheduledSegments.push({
          dateStr: dateStr,
          hours: hoursThisDay,
          fractionOfDay: hoursThisDay / standardHours,
          startHour: startHour,
          endHour: endHour
        });

        remainingHours -= hoursThisDay;
      }

      if (remainingHours > 0.001) {
        // Move to next calendar day
        curr.setDate(curr.getDate() + 1);
      }
    }

    const lastSegment = scheduledSegments[scheduledSegments.length - 1];
    const endDateStr = lastSegment ? lastSegment.dateStr : this.formatDate(curr);

    return {
      startDateStr: scheduledSegments.length > 0 ? scheduledSegments[0].dateStr : this.formatDate(curr),
      endDateStr: endDateStr,
      scheduledSegments: scheduledSegments,
      endHour: lastSegment ? lastSegment.endHour : 17
    };
  },

  /**
   * Format ISO date/time string to: "02 September 2026, 07:45 pm"
   */
  formatLastUpdated(dateInput) {
    if (!dateInput) return '02 September 2026, 07:45 pm';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);

    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const day = String(d.getDate()).padStart(2, '0');
    const month = months[d.getMonth()];
    const year = d.getFullYear();

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = String(hours).padStart(2, '0');

    return `${day} ${month} ${year}, ${hoursStr}:${minutes} ${ampm}`;
  }
};
