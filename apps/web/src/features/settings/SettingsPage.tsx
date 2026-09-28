import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ForbiddenState } from "../../components/states/StateViews";
import { useAuth } from "../../lib/auth-context";
import { AiSettingsPanel } from "./AiSettingsPanel";
import { CataloguePanel } from "./CataloguePanel";
import { MembersPanel } from "./MembersPanel";

export function SettingsPage() {
  const { me } = useAuth();

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        Settings
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Workspace configuration for{" "}
        {me?.organization.name ?? "your organization"}.
      </p>

      {me && me.role !== "admin" ? (
        <ForbiddenState
          role={me.role}
          what="change workspace settings"
          allowed="Admins"
        />
      ) : (
        <Tabs defaultValue="members" className="mt-6">
          <TabsList>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="catalogue">Catalogue</TabsTrigger>
            <TabsTrigger value="ai">AI</TabsTrigger>
          </TabsList>
          <TabsContent value="members">
            <MembersPanel />
          </TabsContent>
          <TabsContent value="catalogue">
            <CataloguePanel />
          </TabsContent>
          <TabsContent value="ai">
            <AiSettingsPanel />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
