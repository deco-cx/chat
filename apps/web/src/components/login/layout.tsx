import { cn } from "@deco/ui/lib/utils.ts";

export function SplitScreenLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-screen h-screen flex">
      <div className={cn("hidden md:block md:w-1/2 bg-cover")}>
        <div className="p-6 h-full">
          <div className="flex flex-col gap-10 bg-primary-light items-center justify-center h-full rounded-lg">
            <p className="text-primary-dark text-6xl text-center">
              Your <span className="text-7xl font-crimson-pro italic">new</span>
              <br />
              AI Workspace
            </p>
            <img
              src="https://assets.decocache.com/decochat/e0d43f1b-8193-4e1f-9992-c94a28342cce/deochatlogo.svg"
              className="h-6 rounded-lg mb-6"
            />
          </div>
        </div>
      </div>
      <div className="w-full md:w-1/2 h-full">{children}</div>
    </div>
  );
}
