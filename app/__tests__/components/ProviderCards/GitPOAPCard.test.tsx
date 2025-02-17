import React from "react";
import { fireEvent, screen, waitFor, waitForElementToBeRemoved } from "@testing-library/react";
import { GitPOAPCard } from "../../../components/ProviderCards";

import { UserContextState } from "../../../context/userContext";
import { mockAddress } from "../../../__test-fixtures__/onboardHookValues";
import { STAMP_PROVIDERS } from "../../../config/providers";
import { gitpoapStampFixture } from "../../../__test-fixtures__/databaseStorageFixtures";
import { SUCCESSFUL_GITPOAP_RESULT } from "../../../__test-fixtures__/verifiableCredentialResults";
import { fetchVerifiableCredential } from "@gitcoin/passport-identity/dist/commonjs/src/credentials";
import {
  makeTestCeramicContext,
  makeTestUserContext,
  renderWithContext,
} from "../../../__test-fixtures__/contextTestHelpers";
import { CeramicContextState } from "../../../context/ceramicContext";
import { mock } from "jest-mock-extended";
import { JsonRpcSigner } from "@ethersproject/providers";

jest.mock("@gitcoin/passport-identity/dist/commonjs/src/credentials", () => ({
  fetchVerifiableCredential: jest.fn(),
}));
jest.mock("../../../utils/onboard.ts");

const mockHandleConnection = jest.fn();
const mockCreatePassport = jest.fn();
const mockHandleAddStamp = jest.fn().mockResolvedValue(undefined);
const mockSigner = mock(JsonRpcSigner) as unknown as JsonRpcSigner;

const mockUserContext: UserContextState = makeTestUserContext({
  handleConnection: mockHandleConnection,
  address: mockAddress,
  signer: mockSigner,
});
const mockCeramicContext: CeramicContextState = makeTestCeramicContext({
  handleCreatePassport: mockCreatePassport,
  handleAddStamp: mockHandleAddStamp,
});

describe("when user has not verified with GitPOAPProvider", () => {
  it("should display a verification button", () => {
    renderWithContext(mockUserContext, mockCeramicContext, <GitPOAPCard />);

    const initialVerifyButton = screen.queryByTestId("button-verify-gitpoap");

    expect(initialVerifyButton).toBeInTheDocument();
  });
});

describe("when user has verified with GitPOAPProvider", () => {
  it("should display that GitPOAP is verified", () => {
    renderWithContext(
      mockUserContext,
      {
        ...mockCeramicContext,
        allProvidersState: {
          GitPOAP: {
            providerSpec: STAMP_PROVIDERS.GitPOAP,
            stamp: gitpoapStampFixture,
          },
        },
      },
      <GitPOAPCard />
    );

    const gitPOAPVerified = screen.queryByText(/Verified/);

    expect(gitPOAPVerified).toBeInTheDocument();
  });

  it("should be able to delete the stamp", async () => {
    const mockHandleDeleteStamp = jest.fn().mockResolvedValue(undefined);

    const mockCeramicContext: CeramicContextState = makeTestCeramicContext({
      handleDeleteStamp: mockHandleDeleteStamp,
    });

    mockCeramicContext.allProvidersState.GitPOAP = {
      providerSpec: STAMP_PROVIDERS.GitPOAP,
      stamp: {
        provider: "GitPOAP",
        streamId: "STREAM-ID",
        credential: {
          type: ["VerifiableCredential"],
          proof: {
            jws: "this is the jws",
            type: "Ed25519Signature2018",
            created: "2022-07-01T11:02:03.186Z",
            proofPurpose: "assertionMethod",
            verificationMethod: "did:key:klsdhcu263789gd870237gd8ewg7823#,dsjnbjklhy923769-dhskjcjsdky8973",
          },
          issuer: "did:key:cdsmlkanfosiu892738921374923ure",
          "@context": ["https://www.w3.org/2018/credentials/v1"],
          issuanceDate: "2022-07-21T11:02:03.185Z",
          expirationDate: "2022-10-19T11:02:03.185Z",
          credentialSubject: {
            id: "did:pkh:eip155:1:0xojicsd86238hdsiy89q7e",
            hash: "v0.0.0:cdsdnkowu827380dsfhfoushfousd",
            "@context": [{ hash: "https://schema.org/Text", provider: "https://schema.org/Text" }],
            provider: "GitPOAP",
          },
        },
      },
    };

    renderWithContext(mockUserContext, mockCeramicContext, <GitPOAPCard />);

    // Open menu (click the menu button)
    const menuButton = screen.queryByTestId("card-menu-button");
    fireEvent.click(menuButton!);

    // Click the delete option
    const deleteMenuOption = screen.queryByTestId("remove-stamp");
    fireEvent.click(deleteMenuOption!);

    expect(mockHandleDeleteStamp).toBeCalledWith("STREAM-ID");
  });
});

describe("when the verify button is clicked", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("and when a successful GitPOAP result is returned", () => {
    beforeEach(() => {
      (fetchVerifiableCredential as jest.Mock).mockResolvedValue(SUCCESSFUL_GITPOAP_RESULT);
    });

    it("the modal displays the verify button", async () => {
      renderWithContext(mockUserContext, mockCeramicContext, <GitPOAPCard />);

      const initialVerifyButton = screen.queryByTestId("button-verify-gitpoap");

      fireEvent.click(initialVerifyButton!);

      const verifyModal = await screen.findByRole("dialog");
      const verifyModalButton = screen.getByTestId("modal-verify-btn");

      expect(verifyModal).toBeInTheDocument();

      await waitFor(() => {
        expect(verifyModalButton).toBeInTheDocument();
      });
    });

    it("clicking verify adds the stamp", async () => {
      renderWithContext(mockUserContext, mockCeramicContext, <GitPOAPCard />);

      const initialVerifyButton = screen.queryByTestId("button-verify-gitpoap");

      // Click verify button on GitPOAP card
      fireEvent.click(initialVerifyButton!);

      // Wait to see the verify button on the modal
      await waitFor(() => {
        const verifyModalButton = screen.getByTestId("modal-verify-btn");
        expect(verifyModalButton).toBeInTheDocument();
      });

      const finalVerifyButton = screen.queryByRole("button", {
        name: /Verify/,
      });

      // Click the verify button on modal
      fireEvent.click(finalVerifyButton!);

      await waitFor(() => {
        expect(mockHandleAddStamp).toBeCalled();
      });

      // Wait to see the done toast
      await waitFor(() => {
        const doneToast = screen.getByTestId("toast-done-gitpoap");
        expect(doneToast).toBeInTheDocument();
      });
    });

    it("clicking cancel closes the modal and a stamp should not be added", async () => {
      (fetchVerifiableCredential as jest.Mock).mockResolvedValue(SUCCESSFUL_GITPOAP_RESULT);
      renderWithContext(mockUserContext, mockCeramicContext, <GitPOAPCard />);

      const initialVerifyButton = screen.queryByTestId("button-verify-gitpoap");

      fireEvent.click(initialVerifyButton!);

      // Wait to see the cancel button on the modal
      let modalCancelButton: HTMLElement | null = null;
      await waitFor(() => {
        modalCancelButton = screen.queryByRole("button", {
          name: /Cancel/,
        });
        expect(modalCancelButton).toBeInTheDocument();
      });

      fireEvent.click(modalCancelButton!);

      expect(mockHandleAddStamp).not.toBeCalled();

      await waitForElementToBeRemoved(modalCancelButton);
      expect(modalCancelButton).not.toBeInTheDocument();
    });
  });

  describe("and when a failed GitPOAP result is returned", () => {
    it("modal displays a failed message", async () => {
      (fetchVerifiableCredential as jest.Mock).mockRejectedValue("ERROR");
      renderWithContext(mockUserContext, mockCeramicContext, <GitPOAPCard />);

      const initialVerifyButton = screen.queryByTestId("button-verify-gitpoap");

      fireEvent.click(initialVerifyButton!);

      const verifyModal = await screen.findByRole("dialog");
      expect(verifyModal).toBeInTheDocument();

      expect(
        screen.getByText(
          "We checked for GitPOAP badges and did not find GitPOAP badge(s) that are 15 or more days old."
        )
      );

      expect(screen.getByText("Go to GitPOAP"));

      expect(screen.getByText("Cancel"));
    });
  });
});
