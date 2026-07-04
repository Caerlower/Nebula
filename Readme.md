# Nebula

**A Stellar wallet for AI agents.**

---

Something strange happens when you watch a capable AI agent work. It reads, it reasons, it plans across a dozen steps, it writes code and calls tools and chains everything together toward a goal. And then it hits a paywall, and it just stops. It turns around and asks you, the human, to go handle the money.

For all the progress in what agents can think about, they still can't do the one thing that would make them independent: pay for things. Every API that charges, every service that meters, every transaction that needs settling becomes a wall the agent can't climb on its own.

Nebula is about tearing that wall down on Stellar.

---

## What it is

Nebula gives an AI agent a real Stellar wallet and the ability to use it. Not a simulated balance, not a sandbox, but an actual account that can hold funds, send USDC, pay for services, and move through Stellar's financial ecosystem the way a person with a wallet would.

It plugs into an agent the same way any other capability does. Once connected, the agent gains a new set of things it can do: check what it holds, pay for what it needs, and put idle funds to work, all through the tools it already knows how to call. The agent doesn't manage keys or build transactions. It expresses intent, and Nebula handles the mechanics underneath.

The point is not to hand an agent your money and hope for the best. The point is to give it a bounded, controllable wallet that lets it act on its own within limits you set, and never a step beyond them.

---

## The two halves of the problem

Giving an agent a wallet raises two questions immediately. How does it pay for things it finds along the way? And how do you make sure it never does something you didn't intend? Nebula is built around answering both.

### Paying, without stopping

Most of what an agent needs to pay for looks the same: it requests something, the thing costs money, and normally that's where the agent gets stuck. Nebula changes what happens at that moment. When the agent runs into a charge, the payment is handled inline, USDC moves on Stellar, and the agent continues as if the wall was never there. From the agent's side, paying for something is just part of getting it.

Some situations don't fit a one-payment-per-request model, though. An agent streaming data or making rapid repeated calls shouldn't have to settle every single one separately. For those, Nebula lets the agent open a session with a set budget, work freely inside it, and settle the whole thing once when it's done. Fast when it needs to be fast, precise when it needs to be precise.

### Control that can't be argued with

An agent that can spend is only useful if it can't spend recklessly. Nebula treats the spending policy as the thing that comes first, not an afterthought. Before any transaction is signed, it's measured against the limits you've set, a ceiling per payment and a ceiling per day, and if it doesn't fit, it doesn't happen. This isn't a suggestion the agent chooses to follow. It's enforced beneath the agent, where the agent can't reach.

You also decide how much rope the agent gets. Let it run fully on its own inside its limits, approve it for a working session at a time, or keep a hand on every transaction and sign off individually. Whichever you choose, everything the agent does is written down, an on-chain record of every payment it has ever made, so there's never a question of where the money went.

---

## More than spending

A wallet that can only send money is a narrow thing. What makes Stellar interesting is that there's a real financial system on it, and an agent with a Nebula wallet can reach into it.

Idle funds don't have to sit idle. The agent can move them into lending pools to earn, swap between assets when it makes sense, and read live prices to reason about what to do. The same wallet that pays for an API call can also decide that the leftover balance is better off earning yield until it's needed. The agent isn't just a spender. It's a small economic actor that can hold, deploy, and manage what it has.

---

## Why Stellar

This idea falls apart on most networks for a boring but fatal reason: the fee to move money would cost more than the money being moved. Agent payments are small and frequent by nature. A network where each transaction costs a few cents and takes real time to confirm can't support that. Stellar can. Fees are a rounding error, settlement takes seconds, and stablecoins are native to how the network works.

There's also simply somewhere for the agent to go. Stellar has live payment rails for exactly this kind of machine-to-machine transaction, a growing set of DeFi protocols to interact with, and billions in real-world assets settling on-chain. Nebula isn't waiting for an ecosystem to arrive. It's connecting agents to one that's already here.

---

## Where this goes

The near-term goal is straightforward: make it effortless to give any agent a Stellar wallet it can use safely. But the direction is bigger than that.

As more of the world becomes machine-payable and more agents start doing real work, they'll need somewhere to hold value, somewhere to spend it, and somewhere to put it to work, all without a human in the loop for every step. Nebula's aim is to be that layer on Stellar: the wallet underneath the agent economy, where every agent is funded, bounded, and fully accountable, and the people behind them stay in control.

If agents are going to transact, the goal is to make Stellar the place they do it.

---

## Status

Nebula is in active development. This document describes the concept and design. Setup, configuration, and usage details will land here as the implementation comes together.

---

## License

MIT