import { useMemo, useState } from "react";
import {
  Integration,
  useIntegrations,
  useToolCall,
  type ContractsCommitsItem,
} from "@deco/sdk";
import type { ContractState } from "@deco/sdk/mcp";
import { MicroDollar } from "@deco/sdk/mcp/wallet";
import { Table, type TableColumn } from "../../common/table/index.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { color } from "./util.ts";

export function ContractsTable({
  contractsUsage,
  contractId,
  clauseId,
}: {
  contractsUsage: ContractsCommitsItem[];
  contractId?: string;
  clauseId?: string;
}) {
  const [sortKey, setSortKey] = useState<string>("total");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const { data: integrations } = useIntegrations();
  const [selectedContract, setSelectedContract] = useState<{
    contractId: string;
    integration?: Integration;
  } | null>(null);
  const [contractDetails, setContractDetails] = useState<{
    clauses: { id: string; price: string | number; description?: string }[];
  } | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const enrichedContracts = useMemo(() => {
    if (!contractsUsage || contractsUsage.length === 0) {
      return [];
    }

    return contractsUsage
      .filter((contract) => {
        // Filter by contract if specified
        if (contractId && contract.contractId !== contractId) {
          return false;
        }
        // If a clause filter is selected, only include contracts that have that clause
        if (clauseId) {
          return (contract.clauses || []).some(
            (clause) => clause.clauseId === clauseId,
          );
        }
        return true;
      })
      .map((contract) => {
        let parsedCost: number;
        if (clauseId) {
          // For a specific clause, calculate proportionally from total contract amount
          const clause = (contract.clauses || []).find(
            (c) => c.clauseId === clauseId,
          );
          if (clause) {
            const totalTokensInContract = (contract.clauses || []).reduce(
              (sum, c) => sum + c.amount,
              0,
            );
            if (totalTokensInContract > 0) {
              parsedCost =
                (clause.amount / totalTokensInContract) * contract.amount;
            } else {
              parsedCost = 0;
            }
          } else {
            parsedCost = 0;
          }
        } else {
          // Use the total contract amount (this is already in dollars)
          parsedCost = contract.amount;
        }
        return {
          color: color(contract.contractId),
          totalCost: parsedCost,
          clauses: contract.clauses,
          contractId: contract.contractId,
          callerApp: contract.callerApp || undefined,
          updatedAt: contract.timestamp || new Date().toISOString(),
        };
      });
  }, [contractsUsage, contractId, clauseId]);

  const columns: TableColumn<(typeof enrichedContracts)[0]>[] = [
    {
      id: "color",
      header: "",
      render: (contract) => (
        <div
          className="w-3 h-3 rounded"
          style={{ backgroundColor: contract.color }}
        />
      ),
    },
    {
      id: "title",
      header: "Contract",
      render: (contract) => {
        const integration = integrations?.find(
          (integration) => integration.id === contract.contractId,
        );
        return (
          <div className="flex flex-col">
            {integration && (
              <div className="flex flex-col">
                <span className="font-medium text-sm">{integration.name}</span>
              </div>
            )}
            <ContractInfo
              contract={contract}
              selectedClauseId={clauseId}
              callerApp={contract.callerApp}
              integrations={integrations}
            />
          </div>
        );
      },
      sortable: true,
    },
    {
      id: "total",
      header: "Total Cost",
      render: (contract) => (
        <span className="font-medium">
          {contract.totalCost < 0.01
            ? `$${contract.totalCost.toFixed(8)}`.replace(/\.?0+$/, "")
            : `$${contract.totalCost.toFixed(2)}`}
        </span>
      ),
      sortable: true,
    },
  ];

  const getSortValue = (
    contract: (typeof enrichedContracts)[0],
    key: string,
  ): string | number => {
    switch (key) {
      case "title":
        return contract.contractId.toLowerCase();
      case "updatedAt":
        return new Date(contract.updatedAt).getTime();
      case "total":
        return contract.totalCost;
      default:
        return "";
    }
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev: "asc" | "desc") =>
        prev === "asc" ? "desc" : "asc",
      );
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const sortedContracts = useMemo(() => {
    return [...enrichedContracts].sort((a, b) => {
      const aVal = getSortValue(a, sortKey);
      const bVal = getSortValue(b, sortKey);

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal);
      const bStr = String(bVal);

      if (aStr < bStr) return sortDirection === "asc" ? -1 : 1;
      if (aStr > bStr) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [enrichedContracts, sortKey, sortDirection]);

  return (
    <>
      <Table
        columns={columns}
        data={sortedContracts}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
        onRowClick={(contract) => {
          const integration = integrations?.find(
            (integration) => integration.id === contract.contractId,
          );
          setSelectedContract({
            contractId: contract.contractId,
            integration,
          });
        }}
      />
      {selectedContract && selectedContract.integration?.connection && (
        <ContractDetailsDialog
          selectedContract={{
            contractId: selectedContract.contractId,
            integration: selectedContract.integration!,
          }}
          onClose={() => {
            setSelectedContract(null);
            setContractDetails(null);
          }}
          contractDetails={contractDetails}
          isLoadingDetails={isLoadingDetails}
          onLoadDetails={(details) => setContractDetails(details)}
          setIsLoadingDetails={setIsLoadingDetails}
        />
      )}
      {selectedContract && !selectedContract.integration?.connection && (
        <Dialog onOpenChange={(open) => !open && setSelectedContract(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Contract Details</DialogTitle>
            </DialogHeader>
            <div className="text-center py-8 text-muted-foreground">
              No integration connection found for this contract. Cannot load
              detailed information.
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function ContractInfo({
  contract,
  selectedClauseId,
  callerApp,
  integrations,
}: {
  contract: {
    contractId: string;
    clauses: { clauseId: string; amount: number }[];
  };
  selectedClauseId?: string;
  callerApp?: string;
  integrations?: Integration[];
}) {
  const clausesToRender = useMemo(() => {
    if (!selectedClauseId) return contract.clauses;
    return contract.clauses.filter((c) => c.clauseId === selectedClauseId);
  }, [contract.clauses, selectedClauseId]);

  // Find integration that matches callerApp
  const callerIntegration = useMemo(() => {
    if (!callerApp || !integrations) return null;
    return integrations.find((integration) => integration.name === callerApp);
  }, [callerApp, integrations]);

  return (
    <div className="flex flex-col">
      <div className="flex gap-1 flex-wrap">
        {clausesToRender.map((clause, index) => {
          return (
            <div
              className="bg-primary-foreground rounded-md px-2 py-1 text-xs text-primary-dark flex items-center gap-1"
              key={index}
            >
              <span className="font-medium">× {clause.amount}</span>
              <span className="text-xs">{clause.clauseId}</span>
            </div>
          );
        })}
      </div>
      {callerApp && (
        <div className="mt-2 flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Called by:</span>
          <span className="text-xs font-medium">
            {callerIntegration ? callerIntegration.name : callerApp}
          </span>
        </div>
      )}
    </div>
  );
}

function ContractDetailsDialog({
  selectedContract,
  onClose,
  contractDetails,
  isLoadingDetails,
  onLoadDetails,
  setIsLoadingDetails,
}: {
  selectedContract: {
    contractId: string;
    integration: Integration;
  };
  onClose: () => void;
  contractDetails: {
    clauses: { id: string; price: string | number; description?: string }[];
  } | null;
  isLoadingDetails: boolean;
  onLoadDetails: (details: {
    clauses: { id: string; price: string | number; description?: string }[];
  }) => void;
  setIsLoadingDetails: (loading: boolean) => void;
}) {
  const callTool = useToolCall(selectedContract.integration.connection);

  const handleLoadDetails = async () => {
    setIsLoadingDetails(true);
    try {
      const result = await callTool.mutateAsync({
        name: "CONTRACT_GET",
        arguments: {},
      });

      // Extract from structuredContent instead of direct result
      const typed = result as {
        structuredContent?: { contract?: ContractState };
      };

      const clauses: {
        id: string;
        price: string | number;
        description?: string;
      }[] = typed?.structuredContent?.contract?.clauses || [];

      onLoadDetails({ clauses });
    } catch (error) {
      console.error("CONTRACT_GET error", error);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  function formatPrice(price?: string | number): string | null {
    if (price === undefined) return null;
    try {
      // Contract clause prices are in "dollars per million tokens" format
      // Convert to "dollars per token" for display
      const pricePerMillionTokens =
        typeof price === "string" ? parseFloat(price) : price;
      const pricePerToken = pricePerMillionTokens / 1_000_000; // Convert to dollars per token
      return MicroDollar.fromDollars(pricePerToken).display({
        showAllDecimals: true,
      });
    } catch {
      return typeof price === "number" ? `$${price.toFixed(6)}` : String(price);
    }
  }

  return (
    <Dialog
      open={!!selectedContract}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Contract Details: {selectedContract.integration.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Contract ID</h4>
            <p className="text-sm text-muted-foreground">
              {selectedContract.contractId}
            </p>
          </div>

          {!contractDetails && !isLoadingDetails && (
            <Button onClick={handleLoadDetails} className="w-full">
              Load Contract Details
            </Button>
          )}

          {isLoadingDetails && (
            <div className="flex items-center justify-center py-8">
              <Spinner />
              <span className="ml-2">Loading contract details...</span>
            </div>
          )}

          {contractDetails && (
            <div>
              <h4 className="font-medium mb-2">Clause Details</h4>
              <div className="space-y-2">
                {contractDetails.clauses.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No clauses found in this contract.
                    <br />
                    <span className="text-xs">
                      This integration may not have defined specific pricing
                      clauses.
                    </span>
                  </div>
                ) : (
                  contractDetails.clauses.map((clause, index) => {
                    const priceDisplay = formatPrice(clause.price);
                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{clause.id}</span>
                          {clause.description && (
                            <span className="text-xs text-muted-foreground mt-1">
                              {clause.description}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {priceDisplay || "Price not available"}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
