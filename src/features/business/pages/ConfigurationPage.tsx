import { useSearchParams } from "react-router";
import {
  Building2,
  ChefHat,
  MapPin,
  Palette,
  Printer,
  Scale,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { SelectField } from "../../../components/forms/SelectField";
import { DiningTableIcon } from "../../../components/ui/DiningTableIcon";
import { useAppShell } from "../../../app/layout/shell-context";
import { PreparationAreasPanel } from "../../preparation-areas/components/PreparationAreasPanel";
import { RestaurantTablesPanel } from "../../restaurant-tables/components/RestaurantTablesPanel";
import { EmployeesPanel } from "../../employees/components/EmployeesPanel";
import { OrganizationFiscalPanel } from "../components/OrganizationFiscalPanel";
import { LocationsPanel } from "../components/LocationsPanel";
import { BusinessSettingsPage } from "./BusinessSettingsPage";

const sections = [
  {
    id: "information",
    label: "Perfil público",
    group: "Organización",
    icon: Building2,
  },
  {
    id: "brand",
    label: "Marca y colores",
    group: "Organización",
    icon: Palette,
  },
  {
    id: "fiscal",
    label: "Información legal y fiscal",
    group: "Organización",
    icon: Scale,
  },
  {
    id: "locations",
    label: "Sedes y planta",
    group: "Organización",
    icon: MapPin,
  },
  {
    id: "ticket",
    label: "Comanda de cocina",
    group: "Operación",
    icon: Printer,
  },
  {
    id: "menu",
    label: "Menú público",
    group: "Operación",
    icon: UtensilsCrossed,
  },
  {
    id: "tables",
    label: "Mesas",
    group: "Operación",
    icon: DiningTableIcon,
  },
  {
    id: "areas",
    label: "Áreas de preparación",
    group: "Operación",
    icon: ChefHat,
  },
  {
    id: "employees",
    label: "Empleados y roles",
    group: "Equipo",
    icon: Users,
  },
] as const;

export function ConfigurationPage() {
  const { session } = useAppShell();
  const [params, setParams] = useSearchParams();

  const active =
    sections.find(
      (section) => section.id === params.get("section")
    ) ?? sections[0];

  const scope =
    session.business.id +
    ":" +
    session.membership.id +
    ":" +
    session.accessToken;

  function select(value: string) {
    if (
      value === active.id ||
      !sections.some((section) => section.id === value)
    ) {
      return;
    }

    setParams({ section: value });
  }

  return (
    <div className="configuration">
      <div className="configuration-mobile configuration-card">
        <SelectField
          label="Sección de configuración"
          hideLabel
          value={active.id}
          options={sections.map((section) => ({
            value: section.id,
            label: section.label,
          }))}
          onValueChange={select}
        />
      </div>

      <nav
        className="configuration-nav configuration-card"
        aria-label="Configuración"
      >
        {["Organización", "Operación", "Equipo"].map((group) => (
          <div key={group}>
            <h2>{group}</h2>

            {sections
              .filter((section) => section.group === group)
              .map((section) => (
                <button
                  type="button"
                  key={section.id}
                  aria-current={
                    active.id === section.id ? "page" : undefined
                  }
                  onClick={() => select(section.id)}
                >
                  <section.icon size={17} aria-hidden="true" />
                  {section.label}
                </button>
              ))}
          </div>
        ))}
      </nav>

      <div
        className={
          active.group === "Operación" &&
          active.id !== "areas" &&
          active.id !== "tables"
            ? "configuration-content w-full md:max-w-4xl"
            : "configuration-content"
        }
        key={scope + ":" + active.id}
      >
        {active.id === "fiscal" ? (
          <OrganizationFiscalPanel />
        ) : active.id === "locations" ? (
          <LocationsPanel />
        ) : active.id === "tables" ? (
          <RestaurantTablesPanel />
        ) : active.id === "areas" ? (
          <PreparationAreasPanel />
        ) : active.id === "employees" ? (
          <EmployeesPanel />
        ) : (
          <BusinessSettingsPage section={active.id} />
        )}
      </div>
    </div>
  );
}
