import { NextResponse } from "next/server"

/**
 * Test API - Flow Simulation
 * 
 * This endpoint simulates a complete User → Solver → Complete flow
 * for testing and verification purposes.
 */

export async function GET() {
    const results: Record<string, any> = {
        timestamp: new Date().toISOString(),
        tests: [],
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

    try {
        // Test 1: Create a sell order
        console.log("[Test] Creating sell order...")
        const createOrderResponse = await fetch(`${baseUrl}/api/orders`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: "test_user_001",
                userAddress: "0x1234567890abcdef1234567890abcdef12345678",
                type: "sell",
                amountUsdc: 50,
                amountFiat: 4521,
                fiatCurrency: "INR",
                paymentMethod: "UPI",
                paymentDetails: "testuser@upi",
            }),
        })
        const createOrderResult = await createOrderResponse.json()

        results.tests.push({
            name: "Create Sell Order",
            success: createOrderResult.success,
            orderId: createOrderResult.order?.id,
            message: createOrderResult.message,
        })

        if (!createOrderResult.success) {
            throw new Error("Failed to create order")
        }

        const orderId = createOrderResult.order.id

        // Test 2: Match order (solver accepts)
        console.log("[Test] Solver matching order...")
        const matchResponse = await fetch(`${baseUrl}/api/orders`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                orderId,
                action: "match",
                solverId: "solver_test_001",
                solverAddress: "0xabcdef1234567890abcdef1234567890abcdef12",
            }),
        })
        const matchResult = await matchResponse.json()

        results.tests.push({
            name: "Solver Match Order",
            success: matchResult.success,
            status: matchResult.order?.status,
            message: matchResult.message,
        })

        // Test 3: Mark payment sent
        console.log("[Test] Solver marking payment sent...")
        const paymentResponse = await fetch(`${baseUrl}/api/orders`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                orderId,
                action: "payment_sent",
            }),
        })
        const paymentResult = await paymentResponse.json()

        results.tests.push({
            name: "Mark Payment Sent",
            success: paymentResult.success,
            status: paymentResult.order?.status,
            message: paymentResult.message,
        })

        // Test 4: Complete order (user confirms)
        console.log("[Test] User confirming payment received...")
        const completeResponse = await fetch(`${baseUrl}/api/orders`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                orderId,
                action: "complete",
            }),
        })
        const completeResult = await completeResponse.json()

        results.tests.push({
            name: "Complete Order",
            success: completeResult.success,
            status: completeResult.order?.status,
            completedAt: completeResult.order?.completedAt,
            message: completeResult.message,
        })

        // Test 5: Query orders
        console.log("[Test] Querying orders...")
        const queryResponse = await fetch(`${baseUrl}/api/orders?userId=test_user_001`)
        const queryResult = await queryResponse.json()

        results.tests.push({
            name: "Query Orders",
            success: queryResult.success,
            count: queryResult.count,
            orders: queryResult.orders?.slice(0, 3).map((o: any) => ({
                id: o.id,
                status: o.status,
                amountUsdc: o.amountUsdc,
            })),
        })

        // Summary
        const passedTests = results.tests.filter((t: any) => t.success).length
        const totalTests = results.tests.length

        results.summary = {
            passed: passedTests,
            total: totalTests,
            allPassed: passedTests === totalTests,
            message: passedTests === totalTests
                ? "✅ All tests passed! Full flow working correctly."
                : `⚠️ ${totalTests - passedTests} test(s) failed.`,
        }

        console.log(`[Test] Results: ${passedTests}/${totalTests} passed`)

        return NextResponse.json(results)

    } catch (error) {
        console.error("[Test] Error:", error)
        results.error = (error as Error).message
        results.summary = {
            passed: 0,
            total: 5,
            allPassed: false,
            message: "❌ Test flow failed with error",
        }

        return NextResponse.json(results, { status: 500 })
    }
}
