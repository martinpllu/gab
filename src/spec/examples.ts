/**
 * Example scenarios.
 *
 * These look like the JSON a UI would produce after the user typed in agent
 * names and the UI assigned UUIDs behind the scenes. For readability the
 * UUIDs are bound to local consts at the top of each scenario, but in a
 * real serialised scenario they would simply appear as inline UUID strings.
 */

import type { ChatSpec, AgentId, ScenarioId } from "./types";

// ---------------------------------------------------------------------------
// Scenario 1: round-robin brainstorm
// ---------------------------------------------------------------------------

const s1_alice = "8e1d4c2a-3b6f-4a9e-b8d1-7f2c5a8b9d3e" as AgentId;
const s1_bob = "f4a7c9b2-1e5d-4c8a-9f3b-6d2e7a1c4b5f" as AgentId;
const s1_carol = "2c5b8e3f-9a4d-4e7b-8c1f-5a3d6b9e2f7c" as AgentId;

export const roundRobin: ChatSpec = {
  metadata: {
    id: "9b3e7d1a-5c2f-4e8a-b7d3-1f8c4a6b2e9d" as ScenarioId,
    title: "Round-robin brainstorm",
    description: "Three contributors take turns in a fixed order, broadcasting to all.",
    specVersion: 1,
    createdAt: "2026-05-22T09:00:00Z",
    updatedAt: "2026-05-22T09:00:00Z",
  },
  agents: [
    {
      id: s1_alice,
      name: "Alice",
      model: "anthropic/claude-sonnet-4.5",
      systemPrompt: "You are Alice, an optimistic product strategist.",
      params: { temperature: 0.7 },
    },
    {
      id: s1_bob,
      name: "Bob",
      model: "openai/gpt-5",
      systemPrompt: "You are Bob, a sceptical engineer.",
      params: { temperature: 0.5 },
    },
    {
      id: s1_carol,
      name: "Carol",
      model: "google/gemini-2.5-pro",
      systemPrompt: "You are Carol, a UX researcher focused on the user's voice.",
    },
  ],
  chat: {
    sharedPrompt: "You are designing a new mobile app for elderly users.",
    participants: [s1_alice, s1_bob, s1_carol],
    kickoff: { type: "seed", message: "Let's begin. What should we build?" },
    defaultMessageScope: { type: "broadcast" },
  },
  flow: {
    main: {
      policy: { type: "round-robin" },
      stop: [{ type: "max-rounds", rounds: 3 }],
    },
  },
};

// ---------------------------------------------------------------------------
// Scenario 2: interleaved discussion with bookend turns
// ---------------------------------------------------------------------------

const s2_alice = "a1b2c3d4-e5f6-4789-abcd-ef0123456789" as AgentId;
const s2_bob = "b2c3d4e5-f6a7-4890-bcde-f01234567890" as AgentId;
const s2_carol = "c3d4e5f6-a7b8-4901-cdef-012345678901" as AgentId;
const s2_moderator = "d4e5f6a7-b8c9-4012-def0-123456789012" as AgentId;

export const interleaved: ChatSpec = {
  metadata: {
    id: "11111111-2222-4333-8444-555555555555" as ScenarioId,
    title: "Remote work debate",
    description:
      "An interleaver agent frames the question, alternates turns with three " +
      "perspectives, and summarises. The interleaver's behaviour comes from its " +
      "prompt — the framework just provides the rotation.",
    specVersion: 1,
    createdAt: "2026-05-22T09:30:00Z",
    updatedAt: "2026-05-22T10:15:00Z",
  },
  agents: [
    {
      id: s2_alice,
      name: "Alice",
      model: "anthropic/claude-sonnet-4.5",
      systemPrompt: "You argue for the productivity benefits of remote work.",
      params: { temperature: 0.7 },
    },
    {
      id: s2_bob,
      name: "Bob",
      model: "openai/gpt-5",
      systemPrompt: "You argue for the productivity benefits of in-office work.",
      params: { temperature: 0.5 },
    },
    {
      id: s2_carol,
      name: "Carol",
      model: "google/gemini-2.5-pro",
      systemPrompt: "You argue for a hybrid model.",
    },
    {
      id: s2_moderator,
      name: "Moderator",
      model: "anthropic/claude-opus-4.7",
      systemPrompt:
        "You moderate the discussion. After each speaker, weigh their argument " +
        "fairly and summarise the state of the debate. Respond with DONE on " +
        "its own line when consensus is reached.",
      params: { temperature: 0.2 },
    },
  ],
  chat: {
    sharedPrompt: "Debate whether remote work increases productivity.",
    participants: [s2_alice, s2_bob, s2_carol, s2_moderator],
    kickoff: { type: "agent", agentId: s2_moderator },
    defaultMessageScope: { type: "broadcast" },
  },
  flow: {
    opening: [
      {
        agentId: s2_moderator,
        promptOverride: "Frame the discussion and pose the opening question.",
      },
    ],
    main: {
      policy: {
        type: "interleave",
        interleaver: s2_moderator,
        rotation: [s2_alice, s2_bob, s2_carol],
      },
      stop: [
        { type: "max-rounds", rounds: 4 },
        {
          type: "signal",
          phrase: "DONE",
          caseSensitive: true,
          fromAgent: s2_moderator,
        },
      ],
    },
    closing: [
      {
        agentId: s2_moderator,
        promptOverride:
          "Summarise the strongest points from each side as bullet points.",
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Scenario 3: agent-selected speaker with composed stops
// ---------------------------------------------------------------------------

const s3_dba = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" as AgentId;
const s3_backend = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff" as AgentId;
const s3_sre = "cccccccc-dddd-4eee-8fff-aaaaaaaaaaaa" as AgentId;
const s3_coordinator = "dddddddd-eeee-4fff-8aaa-bbbbbbbbbbbb" as AgentId;

export const agentSelected: ChatSpec = {
  metadata: {
    id: "22222222-3333-4444-8555-666666666666" as ScenarioId,
    title: "Database query triage",
    description: "A coordinator picks the next expert based on the conversation.",
    specVersion: 1,
    createdAt: "2026-05-22T11:00:00Z",
    updatedAt: "2026-05-22T11:00:00Z",
  },
  agents: [
    {
      id: s3_dba,
      name: "DBA",
      model: "anthropic/claude-sonnet-4.5",
      systemPrompt: "You are a database administrator diagnosing query performance.",
    },
    {
      id: s3_backend,
      name: "Backend engineer",
      model: "openai/gpt-5",
      systemPrompt: "You are a backend engineer investigating application causes.",
    },
    {
      id: s3_sre,
      name: "SRE",
      model: "anthropic/claude-sonnet-4.5",
      systemPrompt: "You are an SRE investigating infrastructure and load issues.",
    },
    {
      id: s3_coordinator,
      name: "Coordinator",
      model: "anthropic/claude-opus-4.7",
      systemPrompt:
        "Read the discussion and decide who should speak next. Reply with " +
        "exactly one of: DBA, Backend engineer, SRE. Reply RESOLVED when done.",
      params: { temperature: 0.1 },
    },
  ],
  chat: {
    sharedPrompt: "A query runs in 30ms on staging and 8 seconds in production.",
    participants: [s3_dba, s3_backend, s3_sre],
    kickoff: { type: "user" },
    defaultMessageScope: { type: "broadcast" },
  },
  flow: {
    main: {
      policy: {
        type: "agent-select",
        selectorAgent: s3_coordinator,
      },
      stop: [
        {
          type: "all",
          of: [
            {
              type: "signal",
              phrase: "RESOLVED",
              fromAgent: s3_coordinator,
            },
            { type: "max-turns", turns: 4 },
          ],
        },
        { type: "max-turns", turns: 20 },
        { type: "timeout-ms", ms: 5 * 60_000 },
      ],
    },
  },
};

// ---------------------------------------------------------------------------
// Scenario 4: private brainstorm with an omnipotent observer
// ---------------------------------------------------------------------------

const s4_seller_a = "11111111-aaaa-4bbb-8ccc-111111111111" as AgentId;
const s4_seller_b = "22222222-aaaa-4bbb-8ccc-222222222222" as AgentId;
const s4_buyer = "33333333-aaaa-4bbb-8ccc-333333333333" as AgentId;
const s4_observer = "44444444-aaaa-4bbb-8ccc-444444444444" as AgentId;

export const negotiation: ChatSpec = {
  metadata: {
    id: "33333333-4444-4555-8666-777777777777" as ScenarioId,
    title: "Three-way negotiation with observer",
    description:
      "Three negotiators with private channels and scratchpads. An omnipotent " +
      "observer sees everything and produces a closing assessment.",
    specVersion: 1,
    createdAt: "2026-05-22T13:00:00Z",
    updatedAt: "2026-05-22T13:00:00Z",
  },
  agents: [
    {
      id: s4_seller_a,
      name: "Seller A",
      model: "anthropic/claude-sonnet-4.5",
      systemPrompt:
        "You are Seller A. You want the highest possible price. You may keep " +
        "private notes about your strategy by addressing messages to yourself.",
      defaultMessageScope: { type: "broadcast" },
    },
    {
      id: s4_seller_b,
      name: "Seller B",
      model: "openai/gpt-5",
      systemPrompt:
        "You are Seller B. You also want the highest price but value a quick " +
        "deal more than Seller A does. Keep private notes by writing to yourself.",
      defaultMessageScope: { type: "broadcast" },
    },
    {
      id: s4_buyer,
      name: "Buyer",
      model: "google/gemini-2.5-pro",
      systemPrompt:
        "You are the Buyer. You want the lowest price and may message either " +
        "seller privately to drive a wedge between them.",
      defaultMessageScope: { type: "broadcast" },
    },
    {
      id: s4_observer,
      name: "Observer",
      model: "anthropic/claude-opus-4.7",
      systemPrompt:
        "You silently observe the entire negotiation, including private " +
        "messages and each participant's private notes. At the end, produce " +
        "a fair assessment of who negotiated most effectively and why.",
      omnipotent: true,
      params: { temperature: 0.2 },
    },
  ],
  chat: {
    sharedPrompt:
      "Two sellers and one buyer are negotiating the sale of a used industrial machine. " +
      "Reserve price for sellers: £8,000. Buyer's maximum: £14,000.",
    participants: [s4_seller_a, s4_seller_b, s4_buyer],
    kickoff: { type: "seed", message: "The negotiation is open." },
    defaultMessageScope: { type: "broadcast" },
  },
  flow: {
    main: {
      policy: {
        type: "round-robin",
        order: [s4_seller_a, s4_buyer, s4_seller_b, s4_buyer],
      },
      stop: [
        { type: "max-rounds", rounds: 4 },
        { type: "signal", phrase: "DEAL" },
        { type: "signal", phrase: "WALK AWAY" },
      ],
    },
    closing: [
      {
        agentId: s4_observer,
        promptOverride:
          "Score each participant out of 10 on negotiation effectiveness. " +
          "Cite specific public statements AND private notes / direct messages.",
        scopeOverride: { type: "broadcast" },
      },
    ],
  },
};
