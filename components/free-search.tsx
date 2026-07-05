"use client";

import { useState } from "react";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import clsx from "clsx";
import { Search } from "lucide-react";

import { siteConfig } from "@/config/site";

const BlurredText = ({ text, blurPercentage = 0.4 }: { text: string; blurPercentage?: number }) => {
  const chars = text.split("");
  const blurCount = Math.ceil(chars.length * blurPercentage);
  const blurIndices = new Set<number>();
  
  for (let i = 0; i < blurCount; i++) {
    let randomIdx;
    do {
      randomIdx = Math.floor(Math.random() * chars.length);
    } while (blurIndices.has(randomIdx));
    blurIndices.add(randomIdx);
  }

  return (
    <span>
      {chars.map((char, idx) => (
        <span
          key={idx}
          className={blurIndices.has(idx) ? "blur-sm bg-white/20 rounded" : ""}
        >
          {blurIndices.has(idx) ? "█" : char}
        </span>
      ))}
    </span>
  );
};

export const FreeSearch = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setTimeout(() => {
      setHasSearched(true);
      setIsLoading(false);
    }, 1500);
  };

  const sampleResults = [
    {
      type: "Email Account",
      items: [
        { label: "Email", value: searchQuery || "user@example.com" },
        { label: "Password Hash", value: "$2b$12$############" },
        { label: "Last Login", value: <BlurredText text="2024-03-10 14:32:15" blurPercentage={0.3} /> },
        { label: "Phone", value: <BlurredText text="555-••••-7890" blurPercentage={0.5} /> },
      ],
    },
    {
      type: "Person Information",
      items: [
        { label: "First Name", value: <BlurredText text="Jonathan" blurPercentage={0.4} /> },
        { label: "Last Name", value: <BlurredText text="Smith" blurPercentage={0.3} /> },
        { label: "Residence", value: <BlurredText text="123 Oak Street, Denver CO 80202" blurPercentage={0.35} /> },
        { label: "Date of Birth", value: <BlurredText text="1992-05-15" blurPercentage={0.4} /> },
      ],
    },
    {
      type: "Breach Data",
      items: [
        { label: "Breach Source", value: <BlurredText text="DataLeakDatabase" blurPercentage={0.3} /> },
        { label: "Date Exposed", value: <BlurredText text="2023-08-15" blurPercentage={0.2} /> },
        { label: "Fields Exposed", value: "Email, Password, Phone, Location" },
        { label: "Record Count", value: <BlurredText text="1,542,830 records" blurPercentage={0.4} /> },
      ],
    },
    {
      type: "Payment Info",
      items: [
        { label: "Card Last 4", value: "••••-9428" },
        { label: "Card Type", value: <BlurredText text="Visa" blurPercentage={0.25} /> },
        { label: "Expiry", value: "••/••" },
        { label: "CVV", value: "███" },
      ],
    },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h2 className={clsx("text-2xl md:text-3xl font-bold text-center mb-2 text-white", "[font-family:var(--font-bruno-ace-sc)]")}>
          Try One Free Search
        </h2>
        <p className="text-center text-gray-400 text-sm md:text-base">
          Experience the power of {siteConfig.name} with a free trial search. Sensitive data is blurred to protect privacy.
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-0 mb-8">
        <div className="flex-1 relative">
          <Input
            isClearable
            type="text"
            placeholder="Enter email, username, phone number, IP, or domain..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={hasSearched}
            startContent={<Search className="text-gray-500" size={20} />}
            endContent={
              <button
                type="submit"
                disabled={!searchQuery.trim() || hasSearched}
                className="text-gray-400 hover:text-gray-300 disabled:opacity-50 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7m0 0l-7 7m7-7H6" />
                </svg>
              </button>
            }
            classNames={{
              input: "bg-transparent text-white placeholder:text-gray-600 text-base py-6 pr-12",
              inputWrapper: clsx(
                "bg-black/60 border-2 border-white/20 rounded-2xl",
                "backdrop-blur-md transition-all duration-200",
                "!ring-0 !ring-offset-0 focus:!ring-0",
                "hover:bg-black/60 hover:border-white/20",
                hasSearched && "opacity-50 cursor-not-allowed"
              ),
            }}
          />
        </div>
      </form>

      {hasSearched && (
        <div className="space-y-3">
          {sampleResults.map((result, idx) => (
            <Card key={idx} className="bg-black/50 border border-white/10 rounded-2xl backdrop-blur-md hover:bg-black/60 transition-colors">
              <CardBody className="p-4">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">{result.type}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {result.items.map((item, itemIdx) => (
                    <div key={itemIdx} className="text-xs">
                      <p className="text-gray-500 font-medium">{item.label}</p>
                      <p className="text-gray-200 font-mono mt-1 break-all">{item.value}</p>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          ))}

          <Card className="bg-black/50 border border-white/10 rounded-2xl">
            <CardBody className="p-4">
              <p className="text-sm text-gray-300 text-center">
                Sensitive data is partially blurred. Sign up to see complete, detailed results.
              </p>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
};
