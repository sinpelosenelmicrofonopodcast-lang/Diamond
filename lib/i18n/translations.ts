export type Locale = "es" | "en";

export const defaultLocale: Locale = "es";

export const translations = {
  es: {
    nav: {
      home: "Inicio",
      plans: "Planes",
      login: "Entrar",
      signup: "Crear cuenta",
      profile: "Mi perfil",
      panel: "Mi panel",
      logout: "Salir"
    },
    common: {
      loading: "Cargando...",
      save: "Guardar",
      cancel: "Cancelar",
      confirm: "Confirmar",
      language: "Idioma",
      spanish: "Español",
      english: "English"
    },
    home: {
      title: "Reserva servicios locales con experiencia de lujo",
      subtitle: "LuxApp conecta clientes con negocios de belleza y bienestar con reservas rápidas, depósitos inteligentes y protección anti no-show.",
      ctaSignup: "Crear cuenta gratis",
      ctaLogin: "Ya tengo cuenta",
      featured: "Negocios recomendados",
      deals: "Deals y especiales",
      special: "Especial",
      noDeals: "No hay especiales activos ahora.",
      viewBusiness: "Ver negocio"
    },
    booking: {
      service: "Servicio",
      staff: "Staff",
      dateTime: "Fecha y hora",
      contact: "Tu contacto",
      confirmBooking: "Confirmar reserva",
      bookingCreated: "Reserva creada. Estado:",
      selectService: "Selecciona un servicio.",
      selectSlot: "Selecciona un horario.",
      enterEmail: "Ingresa tu email para confirmar.",
      recommendedSlots: "Horarios recomendados",
      viewAll: "Ver todos",
      viewRecommended: "Ver recomendados",
      policiesTitle: "Políticas antes de reservar",
      cancellation: "Cancelación mínima",
      lateTolerance: "Tolerancia de tardanza",
      requiredDeposit: "Depósito requerido hoy"
    },
    auth: {
      signinTitle: "Entrar con email y contraseña",
      signupTitle: "Crear cuenta con contraseña",
      forgot: "¿Olvidaste tu contraseña?",
      reset: "Restablecer",
      email: "Email",
      password: "Contraseña",
      firstName: "Nombre",
      lastName: "Apellido",
      phone: "Teléfono",
      businessAccount: "Soy negocio",
      clientAccount: "Soy cliente"
    },
    dashboard: {
      overview: "Resumen",
      business: "Negocio",
      calendar: "Calendario",
      appointments: "Citas",
      staff: "Staff",
      services: "Servicios",
      schedule: "Horarios",
      policies: "Políticas",
      payments: "Pagos",
      clients: "Clientes"
    }
  },
  en: {
    nav: {
      home: "Home",
      plans: "Plans",
      login: "Log in",
      signup: "Sign up",
      profile: "My profile",
      panel: "My dashboard",
      logout: "Log out"
    },
    common: {
      loading: "Loading...",
      save: "Save",
      cancel: "Cancel",
      confirm: "Confirm",
      language: "Language",
      spanish: "Español",
      english: "English"
    },
    home: {
      title: "Book local services with a luxury experience",
      subtitle: "LuxApp connects clients with beauty and wellness businesses through fast booking, smart deposits, and no-show protection.",
      ctaSignup: "Create free account",
      ctaLogin: "I already have an account",
      featured: "Featured businesses",
      deals: "Deals & specials",
      special: "Special",
      noDeals: "No active specials right now.",
      viewBusiness: "View business"
    },
    booking: {
      service: "Service",
      staff: "Staff",
      dateTime: "Date & time",
      contact: "Your contact",
      confirmBooking: "Confirm booking",
      bookingCreated: "Booking created. Status:",
      selectService: "Select a service.",
      selectSlot: "Select a time slot.",
      enterEmail: "Enter your email to confirm.",
      recommendedSlots: "Recommended times",
      viewAll: "View all",
      viewRecommended: "View recommended",
      policiesTitle: "Policies before booking",
      cancellation: "Minimum cancellation",
      lateTolerance: "Late tolerance",
      requiredDeposit: "Required deposit today"
    },
    auth: {
      signinTitle: "Sign in with email and password",
      signupTitle: "Create account with password",
      forgot: "Forgot password?",
      reset: "Reset",
      email: "Email",
      password: "Password",
      firstName: "First name",
      lastName: "Last name",
      phone: "Phone",
      businessAccount: "I am a business",
      clientAccount: "I am a client"
    },
    dashboard: {
      overview: "Overview",
      business: "Business",
      calendar: "Calendar",
      appointments: "Appointments",
      staff: "Staff",
      services: "Services",
      schedule: "Schedule",
      policies: "Policies",
      payments: "Payments",
      clients: "Clients"
    }
  }
} as const;

export type TranslationTree = (typeof translations)[Locale];

export function resolveTranslation(locale: Locale, key: string): string {
  const parts = key.split(".");
  let cursor: any = translations[locale];

  for (const part of parts) {
    if (cursor && typeof cursor === "object" && part in cursor) {
      cursor = cursor[part];
    } else {
      return key;
    }
  }

  return typeof cursor === "string" ? cursor : key;
}
