const salesperson =
            followUp.salesperson ||
            "";

          const matchesSearch =
            !search ||
            [
              customerName,
              customerCode,
              salesperson,
              followUp.type,
              followUp.priority,
              followUp.status,
              followUp.summary,
              followUp.nextAction
            ]
              .join(" ")
              .toLowerCase()
              .includes(search);

          const masterCustomer =
            customers.find((customer) =>
              (followUp.customer?._id &&
                customer._id === followUp.customer._id) ||
              (followUp.customer?.customerCode &&
                customer.customerCode === followUp.customer.customerCode) ||
              (!followUp.customer?._id &&
                !followUp.customer?.customerCode &&
                followUp.customer?.name &&
                normalizeName(customer.name) === normalizeName(followUp.customer.name))
            );

          const customerStatus =
            String(
              masterCustomer?.status ||
              followUp.customer?.status ||
              followUp.customerStatus ||
              ""
            ).trim();

          const customerStatuses = [
            "New",
            "Contacted",
            "Quoted",
            "Negotiation",
            "Converted",
            "Lost",
            "Active"
          ];

          const matchesStatus =
            followUpStatusFilter === "All" ||
            (customerStatuses.includes(followUpStatusFilter)
              ? customerStatus === followUpStatusFilter
              : followUp.status === followUpStatusFilter);

          const matchesSalesperson =
            followUpSalespersonFilter ===
              "All" ||
            normalizeName(
              followUp.salesperson
            ) ===
              normalizeName(
                followUpSalespersonFilter
              );

          return (
            matchesSearch &&
            matchesStatus &&
            matchesSalesperson
          );
        }
      );
    }, [
      followUps,
      followUpSearch,
      followUpStatusFilter,
      followUpSalespersonFilter,
      customers
    ]);

  /* =====================================================
     CUSTOMER FORM HANDLERS
  ===================================================== */

  const handleCustomerChange = (e) => {
    const {
      name,
      value
    } = e.target;

    setCustomerForm((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const saveCustomer = async (e) => {
    e.preventDefault();

    if (
      !customerForm.name.trim()
    ) {
      alert(
        "Customer name is required."
      );
      return;
    }

    try {
      setSavingCustomer(true);

      const payload = {
        ...customerForm,

        quotationAmount:
          Number(
            customerForm.quotationAmount ||
              0
          )
      };

      const response =
        await axios.post(
          `${API}/customers`,
          payload
        );

      setCustomers((prev) => [
        response.data,
        ...prev
      ]);

      setCustomerForm({
        name: "",
        phone: "",
        whatsapp: "",
        email: "",
        location: "",
        source: "Walk-in",
        assignedSalesperson: "",
        status: "New",
        productInterest: "",
        quotationAmount: "",
        customerVisitDate: ""
      });

      await loadData();

      alert(
        "Customer saved successfully."
      );
    } catch (error) {
      console.error(error);

      alert(
        error.response?.data
          ?.message ||
          "Failed to save customer."
      );
