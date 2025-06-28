Title: Show last used workspace on top of Switch team selector

### Plan ✅ COMPLETED

1. **Create a Local Storage Utility Hook** ✅
   - Created `apps/web/src/hooks/use-workspace-activity.ts`
   - Exports `getWorkspaceActivity()`: Gets the list of workspace slugs from
     localStorage
   - Exports `addWorkspaceToActivity(slug: string)`: Adds a workspace slug to
     the top of the list, ensuring no duplicates

2. **Track Workspace Changes** ✅
   - Modified `apps/web/src/components/sidebar/team-selector.tsx`
   - Added `useEffect` in `useCurrentTeam` hook to monitor changes in `teamSlug`
     from `useParams`
   - Calls `addWorkspaceToActivity(teamSlug)` whenever `teamSlug` changes

3. **Sort Workspaces in the UI** ✅
   - Modified the `useUserTeams` hook in
     `apps/web/src/components/sidebar/team-selector.tsx`
   - Added sorting logic that prioritizes workspaces based on their position in
     the activity list
   - Workspaces not present in the activity list are placed at the end

### Implementation Details

The feature now works as follows:

- When a user switches to a workspace, it gets added to the top of the
  `workspaceActivity` array in localStorage
- The Switch Team dropdown shows workspaces sorted by most recently used first
- If a user leaves a workspace, it will still appear in the sorted order if they
  rejoin later
- New workspaces that haven't been visited will appear at the bottom of the list
